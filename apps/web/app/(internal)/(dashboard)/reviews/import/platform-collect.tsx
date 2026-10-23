"use client";

// 플랫폼 수집 화면(프로토타입): 우리 제품을 고르고, 그 제품의 경쟁 제품을 플랫폼 랭킹에서 골라 제품별 리뷰를 가져오는 흐름을 보여준다.
// 실제 수집과 저장은 하지 않는다. 진행 상황과 결과는 샘플이다 (collect-sample.ts).
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CATEGORIES,
  type CollectStatus,
  finishRow,
  MAX_STAR_OPTIONS,
  MIN_LOW_OPTIONS,
  REVIEW_LIMITS,
  sampleRanking,
  type SampleRow,
  TOP_N_OPTIONS,
} from "./collect-sample";
import { IMPORT_PLATFORMS } from "./import-platforms";

export type CollectProject = {
  id: string;
  brand: string;
  name: string;
  category: string;
  volumeMl: number | null;
  priceJpy: number | null;
};

const TEXT = {
  title: "플랫폼 수집",
  intro: "우리 제품을 고르고, 플랫폼 랭킹에서 그 제품의 경쟁 제품을 골라 제품별 리뷰를 자동으로 가져와요.",
  sample: "샘플 화면 · 실제 수집과 저장은 아직 연결되지 않았어요",
  flow: "가져오기 버튼 → 수집 요청 → 수집기 실행 → DB에 저장 → 이 화면에 진행 상황 표시",
  projectLabel: "우리 제품",
  projectNote: "수집한 제품은 이 제품의 경쟁 제품으로 저장돼요",
  platform: "플랫폼",
  category: "카테고리",
  topN: "순위",
  maxStar: "수집할 별점",
  limit: "제품당 리뷰",
  minLow: "최소 해당 별점 리뷰",
  loadRanking: "랭킹 불러오기",
  loading: "불러오는 중…",
  emptyHint: "조건을 고르고 랭킹을 불러오면 경쟁 제품 목록이 나와요",
  readRule: "낮은 별점부터 읽다가, 고른 별점을 넘거나 최대 건수에 닿으면 멈춰요. 별점이 낮아도 배송·누락 같은 제품 외 불만일 수 있어서, 가져온 뒤 AI가 본문으로 다시 가려내요.",
  collect: (n: number) => `선택한 ${n}개 제품 리뷰 가져오기`,
  retry: "다시 가져오기",
  selectAll: "전체 선택",
  summary: "현황",
  starSummary: "가져온 리뷰",
  progress: "수집 진행률",
  rankCol: "순위",
  productCol: "제품",
  totalCol: "전체 리뷰",
  lastCol: "마지막 수집",
  collectedCol: "수집",
  nonProductCol: "제품 외 불만",
  statusCol: "상태",
  below: "기준 미달",
} as const;

const METHOD: Record<string, string> = {
  qoo10: "구매자 리뷰 목록을 낮은 별점순으로 읽어요. 체험 후기(샘플 이벤트)는 이 목록에 없어요 (이용약관 확인 후 연결)",
  rakuten: "랭킹은 공식 API, 리뷰는 리뷰 페이지에서 수집해요. 정렬 방식은 조사 중이에요 (이용약관 확인 후 연결)",
};

const STATUS: Record<CollectStatus, { label: string; className?: string; variant?: "secondary" | "outline" }> = {
  done: { label: "✓ 완료", className: "bg-status-approved/15 text-status-approved" },
  partial: { label: "⚠ 일부", className: "bg-status-pending/15 text-status-pending" },
  failed: { label: "✕ 실패", className: "bg-status-rejected/15 text-status-rejected" },
  none: { label: "미수집", variant: "secondary" },
  queued: { label: "대기", variant: "outline" },
  running: { label: "수집 중…", variant: "outline", className: "animate-pulse" },
};

const STAR_LABELS = ["1점", "2점", "3점", "4점", "5점"] as const;
const STEP_MS = 600; // 제품 하나를 처리하는 데 걸리는 시간 (샘플)
const FINISH_MS = 450;

const selectClass = "h-8 w-full rounded-md border bg-background px-2 text-sm disabled:opacity-50";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ChangeCell({ row }: { row: SampleRow }) {
  if (row.change === "new") return <Badge variant="outline">NEW</Badge>;
  if (row.change === "up") return <span className="text-status-approved">▲{row.delta}</span>;
  if (row.change === "down") return <span className="text-status-rejected">▼{row.delta}</span>;
  return <span className="text-muted-foreground">−</span>;
}

function CollectPanel({ project, picker }: { project: CollectProject; picker: ReactNode }) {
  const [platformId, setPlatformId] = useState<string>(IMPORT_PLATFORMS[0].id);
  // 카테고리는 프로젝트(우리 제품)의 카테고리에서 시작한다
  const [categoryId, setCategoryId] = useState<string>(project.category.includes("美容液") ? "serum" : "toner");
  const [topN, setTopN] = useState<number>(20);
  const [maxStar, setMaxStar] = useState<number>(3);
  const [limit, setLimit] = useState<number>(100);
  const [minLow, setMinLow] = useState<number>(10);
  const [rows, setRows] = useState<SampleRow[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [run, setRun] = useState({ total: 0, done: 0 });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const running = run.done < run.total;
  const starLabel = maxStar >= 5 ? "별점 전체" : `1~${maxStar}점`;

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }
  useEffect(() => clearTimers, []);

  // 조건이 바뀌면 지난 목록은 맞지 않으므로 비운다
  function resetList() {
    clearTimers();
    setRows(null);
    setSelected(new Set());
    setRun({ total: 0, done: 0 });
  }
  function change(apply: () => void) {
    apply();
    resetList();
  }

  function loadRanking() {
    resetList();
    setLoading(true);
    timers.current.push(
      setTimeout(() => {
        const next = sampleRanking(platformId, categoryId, topN, maxStar, limit);
        setRows(next);
        // 아직 못 가져왔거나 문제가 있던 제품 중, 광고·세트가 아니고 기준을 채운 것만 미리 체크해 둔다
        setSelected(new Set(next.filter((r) => r.status !== "done" && !r.isAd && !r.isSet && r.lowAvail >= minLow).map((r) => r.rank)));
        setLoading(false);
      }, STEP_MS),
    );
  }

  function collect(ranks: number[], retry: boolean) {
    if (ranks.length === 0) return;
    clearTimers();
    const set = new Set(ranks);
    setRun({ total: ranks.length, done: 0 });
    setRows((prev) => prev && prev.map((r) => (set.has(r.rank) ? { ...r, status: "queued", note: null } : r)));
    ranks.forEach((rank, i) => {
      timers.current.push(
        setTimeout(() => {
          setRows((prev) => prev && prev.map((r) => (r.rank === rank ? { ...r, status: "running" } : r)));
        }, i * STEP_MS),
        setTimeout(() => {
          setRows((prev) => prev && prev.map((r) => (r.rank === rank ? finishRow(r, limit, maxStar, retry) : r)));
          setRun((p) => ({ ...p, done: p.done + 1 }));
        }, i * STEP_MS + FINISH_MS),
      );
    });
  }

  function toggle(rank: number) {
    const next = new Set(selected);
    if (next.has(rank)) next.delete(rank);
    else next.add(rank);
    setSelected(next);
  }

  const platform = IMPORT_PLATFORMS.find((p) => p.id === platformId);
  const countOf = (status: CollectStatus) => rows?.filter((r) => r.status === status).length ?? 0;
  const starTotals = STAR_LABELS.map((_, i) => rows?.reduce((sum, r) => sum + r.stars[i], 0) ?? 0);
  const allSelected = rows !== null && rows.length > 0 && selected.size === rows.length;
  const spec = [project.category, project.volumeMl ? `${project.volumeMl}ml` : null, project.priceJpy ? `${project.priceJpy.toLocaleString("en-US")}円` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{TEXT.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{TEXT.intro}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
          <span className="text-xs text-muted-foreground">{TEXT.projectLabel}</span>
          <span className="font-medium">
            {project.brand} {project.name}
          </span>
          {spec && <span className="text-muted-foreground">{spec}</span>}
          <span className="text-xs text-muted-foreground">· {TEXT.projectNote}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{TEXT.sample}</Badge>
          <span className="text-xs text-muted-foreground">{TEXT.flow}</span>
        </div>

        <div className="grid grid-cols-4 items-end gap-3 text-sm">
          {picker}
          <Field label={TEXT.platform}>
            <select className={selectClass} value={platformId} disabled={running || loading} onChange={(e) => change(() => setPlatformId(e.target.value))}>
              {IMPORT_PLATFORMS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={TEXT.category}>
            <select className={selectClass} value={categoryId} disabled={running || loading} onChange={(e) => change(() => setCategoryId(e.target.value))}>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={TEXT.topN}>
            <select className={selectClass} value={topN} disabled={running || loading} onChange={(e) => change(() => setTopN(Number(e.target.value)))}>
              {TOP_N_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  Top {n}
                </option>
              ))}
            </select>
          </Field>
          <Field label={TEXT.maxStar}>
            <select className={selectClass} value={maxStar} disabled={running || loading} onChange={(e) => change(() => setMaxStar(Number(e.target.value)))}>
              {MAX_STAR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={TEXT.limit}>
            <select className={selectClass} value={limit} disabled={running || loading} onChange={(e) => change(() => setLimit(Number(e.target.value)))}>
              {REVIEW_LIMITS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={TEXT.minLow}>
            <select className={selectClass} value={minLow} disabled={running || loading} onChange={(e) => change(() => setMinLow(Number(e.target.value)))}>
              {MIN_LOW_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex justify-end">
            <Button onClick={loadRanking} disabled={running || loading}>
              {loading ? TEXT.loading : TEXT.loadRanking}
            </Button>
          </div>
        </div>
        {platform && <p className="text-xs text-muted-foreground">{METHOD[platform.id]}</p>}
        <p className="text-xs text-muted-foreground">{TEXT.readRule}</p>

        {!rows && !loading && (
          <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            {TEXT.emptyHint}
          </div>
        )}

        {rows && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-xs text-muted-foreground">{TEXT.summary}</span>
              <Badge className={STATUS.done.className}>완료 {countOf("done")}</Badge>
              <Badge className={STATUS.partial.className}>일부 {countOf("partial")}</Badge>
              <Badge className={STATUS.failed.className}>실패 {countOf("failed")}</Badge>
              <Badge variant="secondary">미수집 {countOf("none")}</Badge>
              {starTotals.some((n) => n > 0) && (
                <>
                  <span className="ml-3 text-xs text-muted-foreground">{TEXT.starSummary}</span>
                  {STAR_LABELS.map((label, i) =>
                    starTotals[i] > 0 ? (
                      <Badge key={label} variant="outline">
                        {label} {starTotals[i].toLocaleString("en-US")}
                      </Badge>
                    ) : null,
                  )}
                </>
              )}
            </div>

            <div className="max-h-[28rem] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        aria-label={TEXT.selectAll}
                        checked={allSelected}
                        disabled={running}
                        onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.rank)))}
                      />
                    </TableHead>
                    <TableHead className="w-24">{TEXT.rankCol}</TableHead>
                    <TableHead>{TEXT.productCol}</TableHead>
                    <TableHead className="text-right">{TEXT.totalCol}</TableHead>
                    <TableHead className="text-right">{starLabel} 리뷰</TableHead>
                    <TableHead>{TEXT.lastCol}</TableHead>
                    <TableHead className="text-right">{TEXT.collectedCol}</TableHead>
                    <TableHead className="text-right">{TEXT.nonProductCol}</TableHead>
                    <TableHead>{TEXT.statusCol}</TableHead>
                    <TableHead className="w-28" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const status = STATUS[r.status];
                    const short = r.lowAvail < minLow;
                    return (
                      <TableRow key={r.rank} className={short || r.isAd ? "text-muted-foreground" : undefined}>
                        <TableCell>
                          <input
                            type="checkbox"
                            className="size-4 accent-primary"
                            aria-label={`${r.rank}위 선택`}
                            checked={selected.has(r.rank)}
                            disabled={running}
                            onChange={() => toggle(r.rank)}
                          />
                        </TableCell>
                        <TableCell>
                          <span className="mr-2 font-medium">{r.rank}</span>
                          <ChangeCell row={r} />
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          <span lang="ja">
                            {r.brand} {r.name}
                          </span>
                          <span className="ml-2 inline-flex gap-1 align-middle">
                            {r.isAd && <Badge variant="outline">PR 광고</Badge>}
                            {r.isSet && <Badge variant="outline">세트</Badge>}
                            {short && <Badge variant="outline">{TEXT.below}</Badge>}
                          </span>
                          {r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.siteCount.toLocaleString("en-US")}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.lowAvail.toLocaleString("en-US")}</TableCell>
                        <TableCell>{r.lastCollected ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.collected.toLocaleString("en-US")}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.collected > 0 ? `${r.nonProduct}%` : "—"}</TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className={status.className}>
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" disabled={running} onClick={() => collect([r.rank], true)}>
                            {TEXT.retry}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={() => collect(rows.filter((r) => selected.has(r.rank)).map((r) => r.rank), false)} disabled={running || selected.size === 0}>
                {TEXT.collect(selected.size)}
              </Button>
              {run.total > 0 && (
                <div className="flex-1 space-y-1">
                  <Progress value={Math.round((run.done / run.total) * 100)} aria-label={TEXT.progress} />
                  <p className="text-xs text-muted-foreground">
                    {run.done} / {run.total} 제품 처리 {running ? "중" : "끝"}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// 프로젝트(우리 제품)는 아직 없어서 지금은 드롭다운으로 고른다.
// 홈 화면에서 프로젝트를 고르게 되면 이 드롭다운을 없애고, 선택된 프로젝트 하나를 CollectPanel에 그대로 넘기면 된다.
export function PlatformCollect({ projects }: { projects: CollectProject[] }) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const project = projects.find((p) => p.id === projectId) ?? projects[0];
  if (!project) return null;

  // key가 바뀌면 지난 목록과 카테고리 기본값이 함께 초기화된다
  return (
    <CollectPanel
      key={project.id}
      project={project}
      picker={
        <Field label={TEXT.projectLabel}>
          <select className={selectClass} value={project.id} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.brand} {p.name}
              </option>
            ))}
          </select>
        </Field>
      }
    />
  );
}
