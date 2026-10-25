"use client";

// 홈 전용: 프로젝트 진행 현황판과 벽돌 상세. 벽돌을 누르면 첫 화면 아래의 상세로 부드럽게 내려간다.
import { CalendarDays, Check, Ellipsis, TriangleAlert, User, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { getBoardProjects } from "@/lib/data";
import { dDay } from "@/lib/format";
import { StageKey, type StageStatus } from "@/lib/schemas/project";

type HomeProject = Awaited<ReturnType<typeof getBoardProjects>>[number];
type HomeStage = HomeProject["stages"][number];

const TEXT = {
  title: "프로젝트 진행 현황",
  hint: "벽돌을 누르면 아래에 상세가 열려요",
  project: "프로젝트",
  nextDue: "다음 마감",
  legend: "상태 표시",
  owner: "담당",
  noOwner: "담당 미정",
  noPeriod: "기간 미정",
  blocker: "막힌 점",
  nextStep: "다음 할 일",
  log: "진행 기록",
  noLog: "아직 기록이 없어요",
  openScreen: "화면 열기 →",
};

/** 단계마다 현황판 열 이름, 상세 제목, 관련 화면 (prototype-plan 2장) */
const STAGES = {
  market: { short: "시장", label: "시장 파악", href: "/market", screen: "시장 개요" },
  competition: { short: "경쟁", label: "경쟁 분석", href: "/market/competitors", screen: "경쟁제품 비교" },
  appeal: { short: "소구", label: "소구점 도출", href: "/reviews/compare", screen: "소구점 찾기" },
  customer: { short: "고객", label: "고객 이해", href: "/survey-results", screen: "응답 집계" },
  message: { short: "문구", label: "메시지 작성·검토", href: "/ad-check/history", screen: "검토 이력" },
  // 플랫폼별 강점 화면을 지워서(2026-10-24 진출 실행 탭 제거) 갈 화면이 없다. 관련 화면이 생기면 다시 잇는다
  channel: { short: "채널", label: "채널 선택", href: null, screen: null },
  promotion: { short: "행사", label: "프로모션 실행", href: "/calendar", screen: "프로모션 캘린더" },
  post_launch: { short: "점검", label: "출시 후 점검", href: "/reviews", screen: "리뷰 리포트" },
} satisfies Record<StageKey, { short: string; label: string; href: string | null; screen: string | null }>;

// 색만으로 구분하지 않고 아이콘을 함께 쓴다. 단계 상태 전용 색 토큰이 아직 없어 globals.css의 기존 토큰을 빌려 쓴다
const STATUS = {
  done: { label: "완료", icon: Check, brick: "bg-status-approved text-white", badge: "bg-status-approved/15 text-status-approved" },
  in_progress: {
    label: "진행 중",
    icon: Ellipsis,
    brick: "bg-sentiment-positive text-white",
    badge: "bg-sentiment-positive/15 text-sentiment-positive",
  },
  blocked: { label: "막힘", icon: TriangleAlert, brick: "bg-risk-medium text-black/80", badge: "bg-risk-medium/15 text-risk-medium" },
  not_started: { label: "시작 전", icon: null, brick: "border border-border bg-background", badge: "bg-muted text-muted-foreground" },
} satisfies Record<StageStatus, { label: string; icon: LucideIcon | null; brick: string; badge: string }>;

const BOARD_ID = "project-board";
const DETAIL_ID = "stage-detail";
const DETAIL_TITLE_ID = "stage-detail-title";

const brickId = (projectId: string, stage: StageKey) => `brick-${projectId}-${stage}`;

/** 움직임 줄이기를 켠 사용자에게는 미끄러지지 않고 바로 이동한다 */
function scrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

/** 끝나지 않은 단계 중 마감이 가장 가까운 단계 */
function nextDue(project: HomeProject): HomeStage | undefined {
  return project.stages
    .filter((s) => s.status !== "done" && s.due_date)
    .toSorted((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))[0];
}

/** "2026-10-01" → "10-01" */
const monthDay = (date: string) => date.slice(5);

// 같은 벽돌을 다시 눌러도 상세로 내려가도록, 누를 때마다 request 번호를 올린다
type Selection = { projectId: string; stage: StageKey; request: number };

const SelectionContext = createContext<{
  selection: Selection | null;
  select: (projectId: string, stage: StageKey) => void;
} | null>(null);

function useSelection() {
  const value = useContext(SelectionContext);
  if (!value) throw new Error("ProjectProgress 안에서만 쓸 수 있다");
  return value;
}

/** 현황판과 상세가 고른 벽돌을 함께 보도록 감싼다 */
export function ProjectProgress({ children }: { children: React.ReactNode }) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const select = (projectId: string, stage: StageKey) =>
    setSelection((prev) => ({ projectId, stage, request: (prev?.request ?? 0) + 1 }));

  return <SelectionContext.Provider value={{ selection, select }}>{children}</SelectionContext.Provider>;
}

function StatusBrick({ status }: { status: StageStatus }) {
  const Icon = STATUS[status].icon;
  return Icon && <Icon aria-hidden className="size-4" />;
}

export function ProjectBoard({ projects }: { projects: HomeProject[] }) {
  const { selection, select } = useSelection();

  return (
    <Card id={BOARD_ID}>
      <CardHeader>
        <CardTitle>{TEXT.title}</CardTitle>
        <CardAction className="text-xs text-muted-foreground">{TEXT.hint}</CardAction>
      </CardHeader>
      <CardContent>
        <table className="w-full table-fixed border-separate border-spacing-x-1.5 border-spacing-y-2">
          <colgroup>
            <col className="w-32" />
            {StageKey.options.map((key) => (
              <col key={key} />
            ))}
            <col className="w-44" />
          </colgroup>
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th scope="col" className="text-left font-normal">
                <span className="sr-only">{TEXT.project}</span>
              </th>
              {StageKey.options.map((key) => (
                <th key={key} scope="col" className="font-normal">
                  {STAGES[key].short}
                </th>
              ))}
              <th scope="col" className="text-right font-normal">
                {TEXT.nextDue}
              </th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => {
              const due = nextDue(project);
              return (
                <tr key={project.id}>
                  <th scope="row" className="text-left leading-tight font-medium">
                    {project.name}
                    <span className="block text-xs font-normal text-muted-foreground">{project.platform}</span>
                  </th>
                  {project.stages.map((stage) => {
                    const active = selection?.projectId === project.id && selection.stage === stage.stage;
                    return (
                      <td key={stage.id}>
                        <button
                          type="button"
                          id={brickId(project.id, stage.stage)}
                          aria-label={`${project.name} ${STAGES[stage.stage].label}: ${STATUS[stage.status].label}`}
                          aria-controls={DETAIL_ID}
                          aria-expanded={active}
                          onClick={() => select(project.id, stage.stage)}
                          className={`flex h-8 w-full items-center justify-center rounded-md hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${STATUS[stage.status].brick} ${
                            active ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : ""
                          }`}
                        >
                          <StatusBrick status={stage.status} />
                        </button>
                      </td>
                    );
                  })}
                  <td className="text-right text-xs">
                    {due?.due_date ? (
                      <>
                        <span className="font-semibold">{dDay(due.due_date)}</span> {due.next_step ?? STAGES[due.stage].label}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <ul aria-label={TEXT.legend} className="mt-2 flex gap-4 text-xs text-muted-foreground">
          {(Object.keys(STATUS) as StageStatus[]).map((status) => (
            <li key={status} className="flex items-center gap-1.5">
              <span className={`flex size-4 items-center justify-center rounded-sm [&>svg]:size-3 ${STATUS[status].brick}`}>
                <StatusBrick status={status} />
              </span>
              {STATUS[status].label}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function StageDetail({ projects }: { projects: HomeProject[] }) {
  const { selection } = useSelection();
  const titleRef = useRef<HTMLHeadingElement>(null);

  // 벽돌을 누를 때마다 상세로 내려가고, 키보드 초점도 상세 제목으로 옮긴다
  useEffect(() => {
    if (!selection) return;
    document.getElementById(DETAIL_ID)?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    titleRef.current?.focus({ preventScroll: true });
  }, [selection]);

  const project = projects.find((p) => p.id === selection?.projectId);
  const stage = project?.stages.find((s) => s.stage === selection?.stage);
  if (!project || !stage) return null;

  const meta = STAGES[stage.stage];
  const status = STATUS[stage.status];
  const StatusIcon = status.icon;
  const period = stage.start_date && stage.due_date ? `${monthDay(stage.start_date)} ~ ${monthDay(stage.due_date)}` : TEXT.noPeriod;

  return (
    // 상세가 짧아도 맨 위까지 올라오도록 최소 높이를 본문 한 화면으로 둔다
    <section
      id={DETAIL_ID}
      aria-labelledby={DETAIL_TITLE_ID}
      className="min-h-[calc(100vh-7.5rem)] scroll-mt-8 border-t border-dashed border-border pt-8"
    >
      <p className="text-sm text-muted-foreground">
        {project.name} · {project.platform}
      </p>
      <div className="mt-1 flex items-center gap-2">
        <h2 id={DETAIL_TITLE_ID} ref={titleRef} tabIndex={-1} className="text-xl font-semibold outline-none">
          {StageKey.options.indexOf(stage.stage) + 1}. {meta.label}
        </h2>
        <Badge className={status.badge}>
          {StatusIcon && <StatusIcon aria-hidden />}
          {status.label}
        </Badge>
      </div>
      <p className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CalendarDays aria-hidden className="size-4" />
          {period}
        </span>
        <span className="inline-flex items-center gap-1">
          <User aria-hidden className="size-4" />
          {stage.owner_name ? `${TEXT.owner} ${stage.owner_name}` : TEXT.noOwner}
        </span>
      </p>

      {stage.blocker && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold">{TEXT.blocker}</h3>
          <p className="mt-1 text-sm">{stage.blocker}</p>
        </div>
      )}
      {stage.next_step && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold">{TEXT.nextStep}</h3>
          <p className="mt-1 text-sm">{stage.next_step}</p>
        </div>
      )}

      <h3 className="mt-5 text-sm font-semibold">{TEXT.log}</h3>
      {stage.log.length > 0 ? (
        <ul className="mt-2 space-y-1.5 border-l border-border pl-3 text-sm">
          {stage.log.map((entry) => (
            <li key={`${entry.date}-${entry.text}`} className="flex gap-3">
              <span className="text-muted-foreground tabular-nums">{monthDay(entry.date)}</span>
              {entry.text}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">{TEXT.noLog}</p>
      )}

      {meta.href && meta.screen && (
        <div className="mt-6">
          <Link href={meta.href} className={buttonVariants({ variant: "outline" })}>
            {meta.screen} {TEXT.openScreen}
          </Link>
        </div>
      )}
    </section>
  );
}
