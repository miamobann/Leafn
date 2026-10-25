"use client";

// 홈 전용: 프로젝트 진행 현황판과 벽돌 상세. 벽돌을 누르면 첫 화면 아래의 상세로 부드럽게 내려간다.
import { CalendarDays, Check, Ellipsis, Info, TriangleAlert, User, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { getBoardProjects } from "@/lib/data";
import { dDay } from "@/lib/format";
import { StageKey, type StageStatus } from "@/lib/schemas/project";

export type HomeProject = Awaited<ReturnType<typeof getBoardProjects>>[number];
type HomeStage = HomeProject["stages"][number];

const TEXT = {
  title: "프로젝트 진행 현황",
  hint: "벽돌을 누르면 아래에 상세가 열려요",
  ownerFilter: "담당",
  allOwners: "전체",
  project: "프로젝트",
  progress: "진행",
  done: "완료",
  nextDue: "다음 마감",
  noDue: "남은 마감 없음",
  legend: "상태 표시",
  owner: "담당",
  noOwner: "담당 미정",
  noPeriod: "기간 미정",
  blocker: "막힌 점",
  nextStep: "다음 할 일",
  log: "진행 기록",
  noLog: "아직 기록이 없어요",
  openScreen: "화면 열기 →",
  stageNav: "단계 이동",
  backToBoard: "현황판으로 ↑",
  stages: "8단계",
};

/** 단계마다 현황판 열 이름, 열 머리 설명, 상세 제목, 관련 화면 (prototype-plan 2장) */
const STAGES = {
  market: { short: "시장", hint: "카테고리 랭킹과 성분 관심도로 시장을 파악해요", label: "시장 파악", href: "/market", screen: "시장 개요" },
  competition: { short: "경쟁", hint: "경쟁 제품의 가격·용량·성분을 비교해요", label: "경쟁 분석", href: "/market/competitors", screen: "경쟁제품 비교" },
  appeal: { short: "소구점", hint: "리뷰에서 찾은 우리 제품의 강점이에요", label: "소구점 도출", href: "/reviews/compare", screen: "소구점 찾기" },
  customer: { short: "고객", hint: "설문으로 피부타입과 고민을 알아봐요", label: "고객 이해", href: "/survey-results", screen: "응답 집계" },
  message: { short: "문구", hint: "광고 문구를 쓰고 약기법 기준으로 검토해요", label: "메시지 작성·검토", href: "/ad-check/history", screen: "검토 이력" },
  // 플랫폼별 강점 화면을 지워서(2026-10-24 진출 실행 탭 제거) 채널 화면이 없다. 생길 때까지 플랫폼 행사가 있는 캘린더로 임시 연결 (2026-10-25)
  channel: { short: "채널", hint: "팔고 알릴 플랫폼을 정해요", label: "채널 선택", href: "/calendar", screen: "프로모션 캘린더" },
  promotion: { short: "행사", hint: "플랫폼 행사와 자사 캠페인을 준비해요", label: "프로모션 실행", href: "/calendar", screen: "프로모션 캘린더" },
  post_launch: { short: "출시 후 점검", hint: "출시 뒤 리뷰로 반응을 점검해요", label: "출시 후 점검", href: "/reviews", screen: "리뷰 리포트" },
} satisfies Record<StageKey, { short: string; hint: string; label: string; href: string; screen: string }>;

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
const OWNER_SELECT_ID = "board-owner-filter";

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

/** 홈 캘린더 할 일 목록에 넣을 현황판 마감: 끝나지 않은 단계 중 마감일이 있는 것 */
export function boardDeadlines(projects: HomeProject[]) {
  return projects.flatMap((project) =>
    project.stages.flatMap((stage) =>
      stage.status !== "done" && stage.due_date
        ? [
            {
              projectId: project.id,
              projectName: project.name,
              stage: stage.stage,
              stageLabel: STAGES[stage.stage].label,
              label: stage.next_step ?? STAGES[stage.stage].label,
              dueDate: stage.due_date,
              blocked: stage.status === "blocked",
              ownerId: stage.owner_id,
            },
          ]
        : [],
    ),
  );
}

export type BoardDeadline = ReturnType<typeof boardDeadlines>[number];

// 같은 벽돌을 다시 눌러도 상세로 내려가도록, 누를 때마다 request 번호를 올린다
type Selection = { projectId: string; stage: StageKey; request: number };

const SelectionContext = createContext<{
  selection: Selection | null;
  select: (projectId: string, stage: StageKey) => void;
  /** 담당자 필터. null이면 전체 */
  owner: string | null;
  setOwner: (owner: string | null) => void;
} | null>(null);

function useSelection() {
  const value = useContext(SelectionContext);
  if (!value) throw new Error("ProjectProgress 안에서만 쓸 수 있다");
  return value;
}

// 홈 밖(캘린더 전체보기)에서 벽돌 상세를 열 때 쓰는 주소: /?stage=<프로젝트 ID>.<단계>
const STAGE_PARAM = "stage";
export const stageHref = (projectId: string, stage: StageKey) => `/?${STAGE_PARAM}=${projectId}.${stage}`;

/** 현황판과 상세, 캘린더 할 일 목록이 고른 벽돌과 담당자 필터를 함께 보도록 감싼다 */
export function ProjectProgress({ children }: { children: React.ReactNode }) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  const select = (projectId: string, stage: StageKey) =>
    setSelection((prev) => ({ projectId, stage, request: (prev?.request ?? 0) + 1 }));

  // 주소에 ?stage= 가 있으면 들어오자마자 그 벽돌 상세를 연다
  useEffect(() => {
    const [projectId, stage] = new URLSearchParams(window.location.search).get(STAGE_PARAM)?.split(".") ?? [];
    const key = StageKey.safeParse(stage);
    if (projectId && key.success) setSelection({ projectId, stage: key.data, request: 1 });
  }, []);

  return <SelectionContext.Provider value={{ selection, select, owner, setOwner }}>{children}</SelectionContext.Provider>;
}

/** 현황판 밖(캘린더 할 일 목록)에서 벽돌을 누른 것처럼 상세를 연다. 홈이 아니면(현황판이 없으면) null */
export function useStageSelect() {
  return useContext(SelectionContext)?.select ?? null;
}

/** 현황판에서 고른 담당자. 캘린더 할 일 목록도 같은 사람 것만 보인다. 홈이 아니면 null(전체) */
export function useOwnerFilter() {
  return useContext(SelectionContext)?.owner ?? null;
}

function StatusBrick({ status }: { status: StageStatus }) {
  const Icon = STATUS[status].icon;
  return Icon && <Icon aria-hidden className="size-4" />;
}

export function ProjectBoard({ projects }: { projects: HomeProject[] }) {
  const { selection, select, owner, setOwner } = useSelection();
  // 단계에 담당이 정해진 사람만 고를 수 있다
  const owners = [
    ...new Map(projects.flatMap((p) => p.stages).flatMap((s) => (s.owner_id && s.owner_name ? [[s.owner_id, s.owner_name] as const] : []))),
  ];

  return (
    <Card id={BOARD_ID}>
      <CardHeader>
        <CardTitle>{TEXT.title}</CardTitle>
        <CardAction className="flex items-center gap-4 text-xs text-muted-foreground">
          {owners.length > 0 && (
            <span className="flex items-center gap-1.5">
              <label htmlFor={OWNER_SELECT_ID}>{TEXT.ownerFilter}</label>
              <select
                id={OWNER_SELECT_ID}
                value={owner ?? ""}
                onChange={(e) => setOwner(e.target.value || null)}
                className="rounded-md border bg-background px-2 py-1 text-foreground"
              >
                <option value="">{TEXT.allOwners}</option>
                {owners.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </span>
          )}
          {TEXT.hint}
        </CardAction>
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
                  {/* 마우스를 올리거나 키보드로 고르면 단계 설명이 보인다 */}
                  <span className="group relative inline-flex">
                    <button
                      type="button"
                      aria-describedby={`stage-hint-${key}`}
                      className="inline-flex cursor-help items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {STAGES[key].short}
                      <Info aria-hidden className="size-3" />
                    </button>
                    <span
                      role="tooltip"
                      id={`stage-hint-${key}`}
                      className="pointer-events-none absolute top-full left-1/2 z-10 mt-1.5 hidden w-48 -translate-x-1/2 rounded-md bg-foreground px-2.5 py-1.5 text-left leading-snug text-background group-focus-within:block group-hover:block"
                    >
                      {STAGES[key].hint}
                    </span>
                  </span>
                </th>
              ))}
              <th scope="col" className="text-right font-normal">
                {TEXT.progress}
              </th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => {
              const due = nextDue(project);
              const doneCount = project.stages.filter((s) => s.status === "done").length;
              return (
                <tr key={project.id}>
                  <th scope="row" className="text-left leading-tight font-medium">
                    {project.name}
                    <span className="block text-xs font-normal text-muted-foreground">{project.platform}</span>
                  </th>
                  {project.stages.map((stage) => {
                    const active = selection?.projectId === project.id && selection.stage === stage.stage;
                    // 담당자를 고르면 다른 사람 단계는 흐리게 둔다 (누르면 상세는 그대로 열린다)
                    const dimmed = owner !== null && stage.owner_id !== owner;
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
                          } ${dimmed ? "opacity-30" : ""}`}
                        >
                          <StatusBrick status={stage.status} />
                        </button>
                      </td>
                    );
                  })}
                  <td className="text-right text-xs">
                    <span className="block text-sm">
                      <span className="font-semibold">
                        {doneCount}/{project.stages.length}
                      </span>{" "}
                      {TEXT.done}
                    </span>
                    <Progress
                      value={(doneCount / project.stages.length) * 100}
                      aria-label={`${project.name} ${project.stages.length}단계 중 ${doneCount}단계 완료`}
                      className="my-1"
                    />
                    <span className="block truncate text-muted-foreground">
                      {due?.due_date ? `${TEXT.nextDue} ${dDay(due.due_date)} · ${due.next_step ?? STAGES[due.stage].label}` : TEXT.noDue}
                    </span>
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
  const { selection, select } = useSelection();
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
  const index = StageKey.options.indexOf(stage.stage);
  const prev = project.stages.find((s) => s.stage === StageKey.options[index - 1]);
  const next = project.stages.find((s) => s.stage === StageKey.options[index + 1]);

  // 현황판으로 올라가면 보던 벽돌에 키보드 초점을 둔다
  const backToBoard = () => {
    document.getElementById(BOARD_ID)?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    document.getElementById(brickId(project.id, stage.stage))?.focus({ preventScroll: true });
  };

  return (
    // 상세가 짧아도 맨 위까지 올라오도록 최소 높이를 본문 한 화면으로 둔다
    <section
      id={DETAIL_ID}
      aria-labelledby={DETAIL_TITLE_ID}
      className="flex min-h-[calc(100vh-7.5rem)] scroll-mt-8 flex-wrap items-start gap-8 border-t border-dashed border-border pt-8"
    >
      <div className="min-w-0 flex-[999_1_32rem]">
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

        <div className="mt-6">
          <Link href={meta.href} className={buttonVariants({ variant: "outline" })}>
            {meta.screen} {TEXT.openScreen}
          </Link>
        </div>

        {/* 다른 단계로 가려고 현황판까지 다시 올라가지 않도록 앞뒤 단계와 현황판으로 가는 길을 둔다 */}
        <nav aria-label={TEXT.stageNav} className="mt-8 grid grid-cols-3 items-center gap-3 border-t pt-4 text-sm">
          {prev ? (
            <button type="button" onClick={() => select(project.id, prev.stage)} className="justify-self-start hover:underline">
              ← {index}. {STAGES[prev.stage].label}
            </button>
          ) : (
            <span />
          )}
          <button type="button" onClick={backToBoard} className="justify-self-center text-muted-foreground hover:text-foreground">
            {TEXT.backToBoard}
          </button>
          {next && (
            <button type="button" onClick={() => select(project.id, next.stage)} className="justify-self-end hover:underline">
              {index + 2}. {STAGES[next.stage].label} →
            </button>
          )}
        </nav>
      </div>

      <aside aria-labelledby="stage-list-title" className="w-72 shrink-0 rounded-xl border p-3">
        <h3 id="stage-list-title" className="mb-1 px-2 text-sm font-semibold">
          {project.name} {TEXT.stages}
        </h3>
        <ol className="space-y-0.5">
          {project.stages.map((s, i) => {
            const current = s.stage === stage.stage;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  aria-current={current ? "step" : undefined}
                  onClick={() => select(project.id, s.stage)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted ${current ? "bg-muted font-medium" : ""}`}
                >
                  <span className={`flex size-4 shrink-0 items-center justify-center rounded-sm [&>svg]:size-3 ${STATUS[s.status].brick}`}>
                    <StatusBrick status={s.status} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {i + 1}. {STAGES[s.stage].label}
                  </span>
                  <span className="text-xs text-muted-foreground">{STATUS[s.status].label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </aside>
    </section>
  );
}
