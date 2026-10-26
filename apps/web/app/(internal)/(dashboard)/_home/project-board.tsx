"use client";

// 홈 전용: 프로젝트 진행 현황판과 벽돌 상세. 벽돌을 누르면 첫 화면 아래의 상세로 부드럽게 내려간다.
// 현황판에는 고른 2개만 보이고, 전체보기(오른쪽 패널)에서 모든 프로젝트를 보고 홈에 보일 2개를 고른다.
import { ArrowRight, CalendarDays, Check, Ellipsis, Info, TriangleAlert, User, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { getBoardProjects } from "@/lib/data";
import { dDay } from "@/lib/format";
import { StageKey, type StageStatus } from "@/lib/schemas/project";

export type HomeProject = Awaited<ReturnType<typeof getBoardProjects>>[number];
type HomeStage = HomeProject["stages"][number];

const TEXT = {
  title: "프로젝트 진행 현황",
  hint: "전체보기에서 '홈에 표시'로 2개를 골라요 · 벽돌을 누르면 상세가 열려요",
  emptyRow: "전체보기에서 '홈에 표시'를 켜면 여기에 보여요",
  all: "전체보기",
  sheetTitle: "프로젝트 전체",
  sheetCount: (n: number) => `${n}개`,
  sheetDescription: "홈 현황판에는 '홈에 표시'를 켠 프로젝트만 보여요. 단계 칸을 누르면 홈에서 그 상세를 열어요.",
  pin: "홈에 표시",
  pinFull: "켜 둔 2개가 홈 현황판에 보여요. 다른 프로젝트를 켜려면 하나를 먼저 꺼 주세요.",
  pinOpen: (n: number) => `${n}개를 더 켤 수 있어요. 켜면 바로 홈 현황판에 보여요.`,
  nowOwner: "지금 담당",
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

// 홈 현황판에 보일 프로젝트 수와, 고른 것을 이 브라우저에 기억하는 키
const PICK_LIMIT = 2;
const PICKS_KEY = "leafn.home.boardPicks";
const SavedPicks = z.array(z.string());

function readSaved(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 기억하지 못해도 현황판은 그대로 동작한다 (새로고침하면 처음 2개로 돌아감)
  }
}

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

/** 끝나지 않은 첫 단계의 담당자 (전체보기의 "지금 담당") */
function currentOwner(project: HomeProject): string | null {
  return project.stages.find((s) => s.status !== "done")?.owner_name ?? null;
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
  /** 홈 현황판에 보일 프로젝트 ID (프로젝트 순서대로, 최대 PICK_LIMIT개) */
  picks: string[];
  togglePick: (projectId: string) => void;
} | null>(null);

function useSelection() {
  const value = useContext(SelectionContext);
  if (!value) throw new Error("ProjectProgress 안에서만 쓸 수 있다");
  return value;
}

// 홈 밖(캘린더 전체보기)에서 벽돌 상세를 열 때 쓰는 주소: /?stage=<프로젝트 ID>.<단계>
const STAGE_PARAM = "stage";
export const stageHref = (projectId: string, stage: StageKey) => `/?${STAGE_PARAM}=${projectId}.${stage}`;

/** 현황판과 상세, 캘린더 할 일 목록이 고른 벽돌과 담당자 필터, 홈에 보일 프로젝트를 함께 보도록 감싼다 */
export function ProjectProgress({ projectIds, children }: { projectIds: string[]; children: React.ReactNode }) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  // 처음엔 앞의 2개. 서버 화면과 어긋나지 않도록, 기억해 둔 선택은 화면이 뜬 뒤에 불러온다
  const [picks, setPicks] = useState(() => projectIds.slice(0, PICK_LIMIT));
  const select = (projectId: string, stage: StageKey) =>
    setSelection((prev) => ({ projectId, stage, request: (prev?.request ?? 0) + 1 }));

  // 지워진 프로젝트 ID는 버린다. 그래서 2개보다 적을 수 있다 (현황판이 빈 줄로 안내)
  useEffect(() => {
    const saved = SavedPicks.safeParse(readSaved(PICKS_KEY));
    if (saved.success) setPicks(projectIds.filter((id) => saved.data.includes(id)).slice(0, PICK_LIMIT));
  }, [projectIds]);

  // 이미 2개를 켰으면 먼저 하나를 꺼야 켤 수 있다
  const togglePick = (projectId: string) => {
    const next = picks.includes(projectId)
      ? picks.filter((id) => id !== projectId)
      : picks.length < PICK_LIMIT
        ? projectIds.filter((id) => id === projectId || picks.includes(id))
        : picks;
    setPicks(next);
    save(PICKS_KEY, next);
  };

  // 주소에 ?stage= 가 있으면 들어오자마자 그 벽돌 상세를 연다
  useEffect(() => {
    const [projectId, stage] = new URLSearchParams(window.location.search).get(STAGE_PARAM)?.split(".") ?? [];
    const key = StageKey.safeParse(stage);
    if (projectId && key.success) setSelection({ projectId, stage: key.data, request: 1 });
  }, []);

  return (
    <SelectionContext.Provider value={{ selection, select, owner, setOwner, picks, togglePick }}>{children}</SelectionContext.Provider>
  );
}

/** 현황판 밖(캘린더 할 일 목록)에서 벽돌을 누른 것처럼 상세를 연다. 홈이 아니면(현황판이 없으면) null */
export function useStageSelect() {
  return useContext(SelectionContext)?.select ?? null;
}

/** 현황판에서 고른 담당자. 캘린더 할 일 목록도 같은 사람 것만 보인다. 홈이 아니면 null(전체) */
export function useOwnerFilter() {
  return useContext(SelectionContext)?.owner ?? null;
}

/** 홈 현황판에 보일 프로젝트 ID. 캘린더 할 일 목록도 이 프로젝트 마감만 넣는다. 홈이 아니면 null(전체) */
export function useBoardPicks() {
  return useContext(SelectionContext)?.picks ?? null;
}

function StatusBrick({ status }: { status: StageStatus }) {
  const Icon = STATUS[status].icon;
  return Icon && <Icon aria-hidden className="size-4" />;
}

export function ProjectBoard({ projects }: { projects: HomeProject[] }) {
  const { selection, select, owner, setOwner, picks } = useSelection();
  const shown = projects.filter((p) => picks.includes(p.id));
  // 현황판 높이가 늘 같도록, 2개보다 적게 골랐으면 빈 줄로 채운다
  const emptyRows = projects.length > 0 ? PICK_LIMIT - shown.length : 0;
  // 현황판에 보이는 단계에 담당이 정해진 사람만 고를 수 있다
  const owners = [
    ...new Map(shown.flatMap((p) => p.stages).flatMap((s) => (s.owner_id && s.owner_name ? [[s.owner_id, s.owner_name] as const] : []))),
  ];

  return (
    <Card id={BOARD_ID}>
      <CardHeader>
        <CardTitle>{TEXT.title}</CardTitle>
        <CardAction className="flex items-center gap-3 text-xs text-muted-foreground">
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
          {projects.length > 0 && <ProjectsSheet projects={projects} />}
        </CardAction>
      </CardHeader>
      <CardContent>
        <table className="w-full table-fixed border-separate border-spacing-x-1.5 border-spacing-y-2">
          <colgroup>
            <col className="w-36" />
            {StageKey.options.map((key) => (
              <col key={key} />
            ))}
            <col className="w-32" />
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
                    {/* 칸이 좁아 긴 이름은 두 줄이 된다. 아이콘을 글자와 같은 줄 흐름에 두어 세 줄로 늘지 않게 한다 */}
                    <button
                      type="button"
                      aria-describedby={`stage-hint-${key}`}
                      className="cursor-help rounded-sm leading-tight hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {STAGES[key].short}
                      <Info aria-hidden className="ml-0.5 inline size-3 align-[-0.125em]" />
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
            {shown.map((project) => {
              const due = nextDue(project);
              const doneCount = project.stages.filter((s) => s.status === "done").length;
              return (
                <tr key={project.id}>
                  <th scope="row" className="text-left leading-tight font-medium">
                    <span title={project.name} className="block truncate">
                      {project.name}
                    </span>
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
                    <span className="flex items-center gap-2">
                      <Progress
                        value={(doneCount / project.stages.length) * 100}
                        aria-label={`${project.name} ${project.stages.length}단계 중 ${doneCount}단계 완료`}
                        className="flex-1"
                      />
                      <span className="shrink-0">
                        <span className="text-sm font-semibold">
                          {doneCount}/{project.stages.length}
                        </span>{" "}
                        {TEXT.done}
                      </span>
                    </span>
                    <span className="block truncate text-muted-foreground">
                      {due?.due_date ? `${TEXT.nextDue} ${dDay(due.due_date)} · ${due.next_step ?? STAGES[due.stage].label}` : TEXT.noDue}
                    </span>
                  </td>
                </tr>
              );
            })}
            {Array.from({ length: emptyRows }, (_, i) => (
              <tr key={`empty-${i}`}>
                <td colSpan={StageKey.options.length + 2}>
                  <p className="flex h-10 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
                    {TEXT.emptyRow}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <ul aria-label={TEXT.legend} className="flex gap-4">
            {(Object.keys(STATUS) as StageStatus[]).map((status) => (
              <li key={status} className="flex items-center gap-1.5">
                <span className={`flex size-4 items-center justify-center rounded-sm [&>svg]:size-3 ${STATUS[status].brick}`}>
                  <StatusBrick status={status} />
                </span>
                {STATUS[status].label}
              </li>
            ))}
          </ul>
          <p className="ml-auto">{TEXT.hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/** 현황판 머리의 "전체보기": 오른쪽 패널에서 모든 프로젝트를 보고, 홈 현황판에 보일 2개를 켜고 끈다 */
function ProjectsSheet({ projects }: { projects: HomeProject[] }) {
  const { select, picks, togglePick } = useSelection();
  const [open, setOpen] = useState(false);
  // 단계 칸을 누르면 패널이 다 닫힌 뒤 상세를 연다. 이때는 초점을 전체보기 버튼으로 돌려보내지 않고 상세 제목에 둔다.
  // 초점 돌려보내기(finalFocus)는 닫힘이 끝난 뒤에 물어보므로, 고른 칸은 다음에 열 때 비운다
  const jumpTo = useRef<{ projectId: string; stage: StageKey } | null>(null);
  const full = picks.length >= PICK_LIMIT;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) jumpTo.current = null;
        setOpen(next);
      }}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen && jumpTo.current) select(jumpTo.current.projectId, jumpTo.current.stage);
      }}
    >
      <SheetTrigger render={<Button variant="outline" size="sm" />}>
        {TEXT.all}
        <span className="font-normal text-muted-foreground">{projects.length}</span>
        <ArrowRight aria-hidden />
      </SheetTrigger>
      <SheetContent finalFocus={() => !jumpTo.current} className="gap-3 overflow-y-auto data-[side=right]:sm:max-w-[35rem]">
        <SheetHeader className="pr-12 pb-0">
          <SheetTitle className="flex items-baseline gap-2 text-lg font-semibold">
            {TEXT.sheetTitle}
            <span className="text-sm font-normal text-muted-foreground">{TEXT.sheetCount(projects.length)}</span>
          </SheetTitle>
          <SheetDescription>{TEXT.sheetDescription}</SheetDescription>
        </SheetHeader>
        <p aria-live="polite" className="mx-4 rounded-lg bg-muted px-2.5 py-2 text-xs text-muted-foreground">
          {TEXT.pin}{" "}
          <b className="font-semibold text-foreground">
            {picks.length}/{PICK_LIMIT}
          </b>{" "}
          · {full ? TEXT.pinFull : TEXT.pinOpen(PICK_LIMIT - picks.length)}
        </p>
        <ul className="space-y-2 px-4 pb-4">
          {projects.map((project) => {
            const on = picks.includes(project.id);
            const due = nextDue(project);
            const doneCount = project.stages.filter((s) => s.status === "done").length;
            const nowOwner = currentOwner(project);
            return (
              <li key={project.id} className={`space-y-1.5 rounded-lg border px-3 py-2.5 ${on ? "border-foreground bg-muted/40" : ""}`}>
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 leading-snug">
                    <span className="block truncate font-semibold">{project.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {project.platform}
                      {nowOwner && ` · ${TEXT.nowOwner} ${nowOwner}`}
                    </span>
                  </span>
                  <span aria-hidden className="text-xs text-muted-foreground">
                    {TEXT.pin}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={`${project.name} ${TEXT.pin}`}
                    disabled={!on && full}
                    onClick={() => togglePick(project.id)}
                    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-40 ${
                      on ? "bg-foreground" : "bg-muted-foreground/50"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-background transition-transform ${on ? "translate-x-4" : ""}`}
                    />
                  </button>
                </div>
                <div className="grid grid-cols-8 gap-1">
                  {project.stages.map((stage) => (
                    <button
                      key={stage.id}
                      type="button"
                      aria-label={`${project.name} ${STAGES[stage.stage].label}: ${STATUS[stage.status].label}`}
                      onClick={() => {
                        jumpTo.current = { projectId: project.id, stage: stage.stage };
                        setOpen(false);
                      }}
                      className={`h-3 rounded-sm hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${STATUS[stage.status].brick}`}
                    />
                  ))}
                </div>
                <p className="text-xs">
                  <b className="font-semibold">
                    {doneCount}/{project.stages.length}
                  </b>{" "}
                  {TEXT.done} ·{" "}
                  <span className="text-muted-foreground">
                    {due?.due_date ? `${TEXT.nextDue} ${dDay(due.due_date)} · ${due.next_step ?? STAGES[due.stage].label}` : TEXT.noDue}
                  </span>
                </p>
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
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
