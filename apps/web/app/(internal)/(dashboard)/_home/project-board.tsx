"use client";

// 홈 프로젝트 진행 현황: 판매 중 제품 × 4개 탭(시장 분석·리뷰 분석·광고 검토·AI 분석)의 결재 상태를 벽돌로 (2026-10-26 홈 새 디자인).
// 값은 /projects 진행 표와 같은 getProgressGrid()에서 온다. 상단 바에서 고른 프로젝트를 따른다.
// 벽돌 색은 홈 새 디자인 시안(대시보드 새 UI 목업)의 현황판 색을 그대로 쓴다
import { ArrowUpRight, Check } from "lucide-react";
import Link from "next/link";
import { type ProjectWithProducts, useProjects } from "@/components/layout/project-store";
import type { getProgressGrid, ProgressCell } from "@/lib/data/submissions";
import { platformLabel } from "@/lib/platforms";
import { SUBMISSION_TAB_LABELS, SubmissionTab } from "@/lib/schemas/submission";

export type HomeGrid = Awaited<ReturnType<typeof getProgressGrid>>;
type GridRow = HomeGrid["rows"][number];

const TEXT = {
  title: "프로젝트 진행 현황",
  basis: "판매 중 제품 · 결재 기준",
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
  waiting: (days: number) => `결재 ${days}일`,
  legend: "상태 표시",
  legendWait: (days: number) => `결재가 ${days}일 넘게 대기`,
  line: { dry: "건성 라인", oily: "지성 라인", combo: "복합성 라인" },
};

type BrickKind = "done" | "doing" | "stuck" | "todo";
type Brick = { kind: BrickKind; label: string; href: string; waitDays: number | null };

// 시안의 현황판 색: 승인 브랜드 초록, 진행 중 연한 하늘색 + 초록 점, 반려 테라코타 테두리, 아직 없음 연한 점선
const BRICK: Record<BrickKind, string> = {
  done: "bg-primary text-primary-foreground",
  doing: "bg-[#e2eaee] text-primary",
  stuck: "border-[1.5px] border-[#a65a3f] bg-card text-[#a65a3f]",
  todo: "border-[1.5px] border-dashed border-accent",
};
const LEGEND: { kind: BrickKind; label: string }[] = [
  { kind: "done", label: "승인" },
  { kind: "doing", label: "진행 중 (작성 · 결재)" },
  { kind: "stuck", label: "반려" },
  { kind: "todo", label: "아직 없음" },
];

const COLUMNS = [...SubmissionTab.options.map((tab) => SUBMISSION_TAB_LABELS[tab]), TEXT.ai];
const ROW = "grid grid-cols-[minmax(170px,1.6fr)_repeat(4,minmax(72px,1fr))_minmax(170px,1.4fr)] items-center gap-3";

/** 시안이 없는 칸이 가는 곳: 그 탭에서 결과를 만든 뒤 시안으로 저장한다 (projects/progress-grid.tsx와 같은 규칙) */
function tabHref(tab: SubmissionTab, productId: string | null) {
  if (tab === "review" && productId) return `/reviews/${productId}`;
  if (tab === "ad") return "/ad-check/history";
  return "/market";
}

function tabBrick(cell: ProgressCell, tab: SubmissionTab, productId: string | null, waiting: Record<string, number>): Brick {
  if (!cell) return { kind: "todo", label: "시안 없음", href: tabHref(tab, productId), waitDays: null };
  const href = cell.latestVersionId ? `/approvals/${cell.latestVersionId}` : tabHref(tab, productId);
  switch (cell.submission.status) {
    case "approved":
      return { kind: "done", label: "승인", href, waitDays: null };
    case "rejected":
      return { kind: "stuck", label: "반려", href, waitDays: null };
    case "in_review":
      return { kind: "doing", label: "결재 대기", href, waitDays: waiting[cell.submission.id] ?? null };
    default:
      return { kind: "doing", label: "작성 중", href, waitDays: null };
  }
}

function aiBrick(row: GridRow): Brick {
  const a = row.latestAnalysis;
  if (!a) return { kind: "todo", label: "없음", href: `/ai-analysis?product=${row.productId}`, waitDays: null };
  return a.lead_checked_at
    ? { kind: "done", label: "팀장 확인", href: `/ai-analysis/${a.id}`, waitDays: null }
    : { kind: "doing", label: "팀장 확인 전", href: `/ai-analysis/${a.id}`, waitDays: null };
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
  waiting,
  staleDays,
}: {
  lines: ProjectWithProducts[];
  /** 프로젝트 ID → 진행 표 */
  grids: Record<string, HomeGrid>;
  /** 결재 대기 중인 시안 ID → 기다린 날 수 */
  waiting: Record<string, number>;
  /** 이 날 수를 넘게 기다리면 벽돌에 "결재 N일"을 붙인다 */
  staleDays: number;
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
        <Link
          href="/projects"
          aria-label={TEXT.all}
          className="ml-auto inline-flex size-9 items-center justify-center rounded-full border border-border hover:bg-muted"
        >
          <ArrowUpRight aria-hidden className="size-4" />
        </Link>
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
          <div role="table" aria-label={TEXT.title} className="flex min-w-[680px] flex-col">
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
              const approved = bricks.filter((b) => b.kind === "done").length;
              const stuckAt = bricks.findIndex((b) => b.kind === "stuck");
              const nextAt = bricks.findIndex((b) => b.kind !== "done");
              const product = productOf.get(row.productId);
              const sub = [product?.skin_line ? TEXT.line[product.skin_line] : null, product?.category, platform].filter(Boolean).join(" · ");
              return (
                <div key={row.productId} role="row" className={`${ROW} border-b border-[#e6efe4] py-3`}>
                  <span role="rowheader" className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-medium">{row.productName}</span>
                    {sub && <span className="truncate text-xs text-muted-foreground">{sub}</span>}
                  </span>
                  {bricks.map((b, i) => {
                    const stale = b.waitDays !== null && b.waitDays > staleDays;
                    return (
                      <span key={COLUMNS[i]} role="cell" className="flex justify-center">
                        <Link
                          href={b.href}
                          aria-label={`${row.productName} ${COLUMNS[i]}: ${b.label}${stale ? `, ${TEXT.waiting(b.waitDays ?? 0)}` : ""}`}
                          title={`${COLUMNS[i]}: ${b.label}`}
                          className={`relative inline-flex h-10 w-16 items-center justify-center rounded-xl hover:opacity-85 ${BRICK[b.kind]}`}
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
                          ? `${TEXT.next} ${COLUMNS[nextAt]} ${bricks[nextAt].label}`
                          : TEXT.allDone}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 범례와 프로젝트 전체 시안을 한 줄에 두어 카드 높이를 줄인다 (아래 캘린더가 첫 화면에 보이도록) */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-foreground/80">
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
        {scope && (
          <p className="ml-auto text-muted-foreground">
            {TEXT.projectScope}:{" "}
            <Link href={scope.href} className="font-medium text-foreground underline-offset-4 hover:underline">
              {scope.label}
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}
