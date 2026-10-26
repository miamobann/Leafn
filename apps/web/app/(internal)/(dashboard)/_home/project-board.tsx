"use client";

// 홈 프로젝트 진행 현황: 판매 중 제품 × 4개 탭(시장 분석·리뷰 분석·광고 검토·AI 분석) (서버 데이터 연동 작업 지침서 4번 A안, 2026-10-26).
// 칸마다 시안 상태(벽돌)와 데이터 준비 숫자(벽돌 아래)를 보여 준다. 값은 lib/data/home.ts getHomeProgress()에서 오고,
// 시안 상태는 /projects 진행 표와 같은 getProgressGrid()다. 상단 바에서 고른 프로젝트를 따른다.
// 벽돌 색은 홈 새 디자인 시안(대시보드 새 UI 목업)의 현황판 색을 그대로 쓴다
import { ArrowUpRight, Check } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import { type ProjectWithProducts, useProjects } from "@/components/layout/project-store";
import type { HomeProgress, HomeReadiness } from "@/lib/data/home";
import type { ProgressCell } from "@/lib/data/submissions";
import { platformLabel } from "@/lib/platforms";
import { SUBMISSION_TAB_LABELS, SubmissionTab } from "@/lib/schemas/submission";
import type { HomeNextEvent } from "./home-header";

type GridRow = HomeProgress["grids"][string]["rows"][number];

const TEXT = {
  title: "프로젝트 진행 현황",
  basis: "판매 중 제품 · 시안 상태와 데이터 준비",
  all: "진행 표 전체 보기",
  product: "제품",
  ai: "AI 분석",
  progress: "진행",
  next: "다음:",
  allDone: "모두 승인",
  redo: "반려 · 다시 올리기",
  noProducts: "판매 중인 제품이 없어요.",
  manage: "프로젝트·제품 관리에서 판매 상태 바꾸기 →",
  projectScope: "프로젝트 전체 시장 분석",
  nextEvent: "다음 행사까지",
  noEvent: "예정된 행사가 없어요",
  waiting: (days: number) => `결재 ${days}일`,
  legend: "상태 표시",
  legendWait: (days: number) => `결재가 ${days}일 넘게 대기`,
  line: { dry: "건성 라인", oily: "지성 라인", combo: "복합성 라인" },
};

// 시안 상태 이름 (지침서 4번): 초안 · 결재 대기 · 승인 · 반려, 시안이 없으면 시작 전
const STATUS = { draft: "초안", in_review: "결재 대기", approved: "승인", rejected: "반려", none: "시작 전" };

type BrickKind = "done" | "doing" | "stuck" | "todo";
/** next = 이 칸에서 할 다음 일 (진행 칸의 "다음:" 문구) */
type Brick = { kind: BrickKind; label: string; next: string | null; href: string; waitDays: number | null };

// 시안의 현황판 색: 승인 브랜드 초록, 진행 중 연한 하늘색 + 초록 점, 반려 테라코타 테두리, 시작 전 연한 점선
const BRICK: Record<BrickKind, string> = {
  done: "bg-primary text-primary-foreground",
  doing: "bg-[#e2eaee] text-primary",
  stuck: "border-[1.5px] border-[#a65a3f] bg-card text-[#a65a3f]",
  todo: "border-[1.5px] border-dashed border-accent",
};
const LEGEND: { kind: BrickKind; label: string }[] = [
  { kind: "done", label: STATUS.approved },
  { kind: "doing", label: `${STATUS.draft} · ${STATUS.in_review}` },
  { kind: "stuck", label: STATUS.rejected },
  { kind: "todo", label: STATUS.none },
];

const COLUMNS = [...SubmissionTab.options.map((tab) => SUBMISSION_TAB_LABELS[tab]), TEXT.ai];
const ROW = "grid grid-cols-[minmax(170px,1.6fr)_repeat(4,minmax(84px,1fr))_minmax(170px,1.4fr)] items-center gap-3";

/** 시안이 없는 칸이 가는 곳: 그 탭에서 결과를 만든 뒤 시안으로 저장한다 (projects/progress-grid.tsx와 같은 규칙) */
function tabHref(tab: SubmissionTab, productId: string | null) {
  if (tab === "review" && productId) return `/reviews/${productId}`;
  if (tab === "ad") return "/ad-check/history";
  return "/market";
}

function tabBrick(cell: ProgressCell, tab: SubmissionTab, productId: string | null, waiting: Record<string, number>): Brick {
  if (!cell) return { kind: "todo", label: STATUS.none, next: "시안 만들기", href: tabHref(tab, productId), waitDays: null };
  const href = cell.latestVersionId ? `/approvals/${cell.latestVersionId}` : tabHref(tab, productId);
  switch (cell.submission.status) {
    case "approved":
      return { kind: "done", label: STATUS.approved, next: null, href, waitDays: null };
    case "rejected":
      return { kind: "stuck", label: STATUS.rejected, next: "다시 올리기", href, waitDays: null };
    case "in_review":
      return { kind: "doing", label: STATUS.in_review, next: STATUS.in_review, href, waitDays: waiting[cell.submission.id] ?? null };
    default:
      return { kind: "doing", label: STATUS.draft, next: "결재 올리기", href, waitDays: null };
  }
}

function aiBrick(row: GridRow): Brick {
  const a = row.latestAnalysis;
  if (!a) return { kind: "todo", label: STATUS.none, next: "실행하기", href: `/ai-analysis?product=${row.productId}`, waitDays: null };
  return a.lead_checked_at
    ? { kind: "done", label: "팀장 확인", next: null, href: `/ai-analysis/${a.id}`, waitDays: null }
    : { kind: "doing", label: "팀장 확인 전", next: "팀장 확인 대기", href: `/ai-analysis/${a.id}`, waitDays: null };
}

const mmdd = (date: string) => date.slice(5);

/** 벽돌 아래 데이터 준비: [보이는 짧은 조각들, 마우스를 올리면 보이는 긴 글] (칸 순서 = COLUMNS) */
function readinessLines(r: HomeReadiness | undefined): [string[], string][] {
  if (!r) return COLUMNS.map(() => [[], ""]);
  const ranking = r.market.rankingDate ? mmdd(r.market.rankingDate) : "없음";
  return [
    [[`경쟁 ${r.market.competitors}`, `랭킹 ${ranking}`], `연결된 경쟁 제품 ${r.market.competitors}개 · 마지막 랭킹 수집 ${r.market.rankingDate ?? "없음"}`],
    [[`리뷰 ${r.review.reviews}`, `분석 ${r.review.analyzed}`], `리뷰 ${r.review.reviews}건 중 ${r.review.analyzed}건 분석`],
    [[`승인 ${r.ad.approved}`, `대기 ${r.ad.pending}`], `문구 검토 승인 ${r.ad.approved}건 · 대기 ${r.ad.pending}건`],
    r.ai.date
      ? [[mmdd(r.ai.date), r.ai.checked ? "팀장 확인" : "확인 전"], `최신 실행 ${r.ai.date} · ${r.ai.checked ? "팀장 확인" : "팀장 확인 전"}`]
      : [["실행 전"], "아직 실행한 AI 분석이 없어요"],
  ];
}

function BrickMark({ kind }: { kind: BrickKind }) {
  if (kind === "done") return <Check aria-hidden className="size-4" strokeWidth={2.6} />;
  if (kind === "stuck") return <span aria-hidden className="text-base font-bold">!</span>;
  if (kind === "doing")
    return (
      <span aria-hidden className="flex gap-[3px]">
        <span className="size-1 rounded-full bg-current" />
        <span className="size-1 rounded-full bg-current" />
        <span className="size-1 rounded-full bg-current" />
      </span>
    );
  return null;
}

export function ProjectBoard({
  lines,
  grids,
  readiness,
  waiting,
  staleDays,
  next,
}: {
  lines: ProjectWithProducts[];
  grids: HomeProgress["grids"];
  readiness: HomeProgress["readiness"];
  waiting: HomeProgress["waiting"];
  /** 이 날 수를 넘게 기다리면 벽돌에 "결재 N일"을 붙인다 */
  staleDays: number;
  /** 다음 행사 (요약 칸과 같은 값) */
  next: HomeNextEvent;
}) {
  const { current } = useProjects(lines);
  const grid = current ? grids[current.id] : undefined;
  const rows = grid?.rows ?? [];
  const productOf = new Map((current?.products ?? []).map((p) => [p.id, p]));
  const platform = current?.platform_id ? platformLabel(current.platform_id) : null;
  const scope = grid?.projectRow.market ? tabBrick(grid.projectRow.market, "market", null, waiting) : null;

  return (
    <section
      aria-labelledby="board-title"
      data-slot="card"
      className="flex min-w-0 flex-[999_1_600px] flex-col gap-3 rounded-xl bg-card px-6 py-5 ring-1 ring-foreground/10"
    >
      <div className="flex items-center gap-3">
        <h2 id="board-title" className="text-lg font-medium">
          {TEXT.title}
        </h2>
        <span className="text-xs text-muted-foreground">{TEXT.basis}</span>
        {/* 프로젝트 전체 시안은 제목 줄에 두어 아래 범례 줄이 두 줄로 늘지 않게 한다 */}
        <div className="ml-auto flex items-center gap-3">
          {scope && (
            <p className="text-xs text-muted-foreground">
              {TEXT.projectScope}:{" "}
              <Link href={scope.href} className="font-medium text-foreground underline-offset-4 hover:underline">
                {scope.label}
              </Link>
            </p>
          )}
          <Link
            href="/projects"
            aria-label={TEXT.all}
            className="inline-flex size-9 items-center justify-center rounded-full border border-border hover:bg-muted"
          >
            <ArrowUpRight aria-hidden className="size-4" />
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {TEXT.noProducts}{" "}
          <Link href="/projects" className="font-medium text-foreground underline-offset-4 hover:underline">
            {TEXT.manage}
          </Link>
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div role="table" aria-label={TEXT.title} className="flex min-w-[720px] flex-col">
            <div role="row" className={`${ROW} border-b border-[#e6efe4] pb-2 text-xs text-muted-foreground`}>
              <span role="columnheader">{TEXT.product}</span>
              {COLUMNS.map((label) => (
                <span key={label} role="columnheader" className="text-center">
                  {label}
                </span>
              ))}
              <span role="columnheader" className="text-right">
                {TEXT.progress}
              </span>
            </div>
            {rows.map((row) => {
              const bricks = [...SubmissionTab.options.map((tab) => tabBrick(row.cells[tab], tab, row.productId, waiting)), aiBrick(row)];
              const ready = readinessLines(readiness[row.productId]);
              const approved = bricks.filter((b) => b.kind === "done").length;
              const stuckAt = bricks.findIndex((b) => b.kind === "stuck");
              const nextAt = bricks.findIndex((b) => b.kind !== "done");
              const product = productOf.get(row.productId);
              const sub = [product?.skin_line ? TEXT.line[product.skin_line] : null, product?.category, platform].filter(Boolean).join(" · ");
              return (
                <div key={row.productId} role="row" className={`${ROW} border-b border-[#e6efe4] py-2.5`}>
                  <span role="rowheader" className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-medium">{row.productName}</span>
                    {sub && <span className="truncate text-xs text-muted-foreground">{sub}</span>}
                  </span>
                  {bricks.map((b, i) => {
                    const stale = b.waitDays !== null && b.waitDays > staleDays;
                    const [short, long] = ready[i];
                    return (
                      <span key={COLUMNS[i]} role="cell" className="flex min-w-0 flex-col items-center gap-1">
                        <Link
                          href={b.href}
                          aria-label={`${row.productName} ${COLUMNS[i]}: ${b.label}${stale ? `, ${TEXT.waiting(b.waitDays ?? 0)}` : ""}. ${long}`}
                          title={`${COLUMNS[i]}: ${b.label}`}
                          className={`relative inline-flex h-9 w-16 items-center justify-center rounded-xl hover:opacity-85 ${BRICK[b.kind]}`}
                        >
                          <BrickMark kind={b.kind} />
                          {stale && (
                            <span
                              aria-hidden
                              className="absolute -top-2.5 -right-3.5 rounded-full bg-status-pending px-1.5 text-[10.5px] leading-[17px] font-bold whitespace-nowrap text-white"
                            >
                              {TEXT.waiting(b.waitDays ?? 0)}
                            </span>
                          )}
                        </Link>
                        {/* 좁은 화면에서는 잘라 내지 않고 조각 단위로 두 줄에 넘긴다 */}
                        <span aria-hidden title={long} className="max-w-full text-center text-[11px] leading-tight text-muted-foreground tabular-nums">
                          {short.map((part, j) => (
                            <Fragment key={part}>
                              {j > 0 && " · "}
                              <span className="whitespace-nowrap">{part}</span>
                            </Fragment>
                          ))}
                        </span>
                      </span>
                    );
                  })}
                  <span role="cell" className="flex flex-col items-end gap-1.5">
                    <span className="text-xl leading-none font-medium tabular-nums">
                      {approved}
                      <span className="text-[13px] font-normal text-muted-foreground"> / {bricks.length} 승인</span>
                    </span>
                    <span className="block h-1.5 w-full max-w-[120px] overflow-hidden rounded-full bg-[#e6efe4]">
                      <span className="block h-full rounded-full bg-[#5e8f68]" style={{ width: `${(approved / bricks.length) * 100}%` }} />
                    </span>
                    <span className={`max-w-full truncate text-xs ${stuckAt >= 0 ? "text-[#a65a3f]" : "text-muted-foreground"}`}>
                      {stuckAt >= 0
                        ? `${COLUMNS[stuckAt]} ${TEXT.redo}`
                        : nextAt >= 0
                          ? `${TEXT.next} ${COLUMNS[nextAt]} ${bricks[nextAt].next ?? ""}`
                          : TEXT.allDone}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 다음 행사와 범례를 한 줄에 두어 카드 높이를 줄인다 (아래 캘린더가 첫 화면에 보이도록) */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-foreground/80">
        <Link href={next ? `/calendar?event=${next.id}` : "/calendar"} className="font-medium text-foreground underline-offset-4 hover:underline">
          {next ? (
            <>
              {TEXT.nextEvent} <b className="font-semibold text-primary">{next.dDay}</b> · {next.title} {next.date}
            </>
          ) : (
            TEXT.noEvent
          )}
        </Link>
        <ul aria-label={TEXT.legend} className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {LEGEND.map((l) => (
            <li key={l.kind} className="flex items-center gap-1.5">
              <span aria-hidden className={`inline-block size-3.5 rounded ${BRICK[l.kind]}`} />
              {l.label}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="rounded-full bg-status-pending px-1.5 text-[10.5px] leading-[17px] font-bold text-white">
              {TEXT.waiting(staleDays)}
            </span>
            {TEXT.legendWait(staleDays)}
          </li>
        </ul>
      </div>
    </section>
  );
}
