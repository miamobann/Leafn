"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { AUTOCOMPLETE_SEEDS, TRENDS_CATEGORIES } from "@/lib/external/search-terms";
import { AutocompleteRunResult, type SearchSnap } from "@/lib/schemas/search";
import { INGREDIENT_MATCH, ingredientInterestRanking, searchTrendStats, type InterestRow, type SearchTermStat } from "@/app/(internal)/(dashboard)/market/_lib/market";
import { ToggleGroup } from "@/app/(internal)/(dashboard)/market/_components/toggle-group";

type RunState = { status: "idle" } | { status: "running" } | { status: "done"; result: AutocompleteRunResult } | { status: "error"; message: string };

function Momentum({ stat }: { stat: SearchTermStat }) {
  if (stat.status === "new") return <Badge>NEW</Badge>;
  if (stat.status === "up") return <span className="text-xs font-medium text-risk-low">▲ {stat.delta}</span>;
  if (stat.status === "down") return <span className="text-xs font-medium text-risk-high">▼ {-stat.delta}</span>;
  return <span className="text-xs text-muted-foreground">–</span>;
}

/** 직전 수집 대비 순위 변화 */
function RankChange({ row, hasPrev }: { row: InterestRow; hasPrev: boolean }) {
  if (!hasPrev) return null;
  if (row.prevRank === null) return <Badge>NEW</Badge>;
  const d = row.prevRank - row.rank;
  if (d > 0) return <span className="text-xs font-medium text-risk-low">▲ {d}</span>;
  if (d < 0) return <span className="text-xs font-medium text-risk-high">▼ {-d}</span>;
  return <span className="text-xs text-muted-foreground">–</span>;
}

async function postJson(url: string, body?: unknown): Promise<{ ok: true; result: AutocompleteRunResult } | { ok: false; message: string }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const json: unknown = await res.json();
    if (!res.ok) {
      const message = typeof json === "object" && json && "error" in json && typeof json.error === "string" ? json.error : `오류 (${res.status})`;
      return { ok: false, message };
    }
    return { ok: true, result: AutocompleteRunResult.parse(json) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "요청 실패" };
  }
}

function RunStatus({ run }: { run: RunState }) {
  if (run.status === "done")
    return (
      <p className="text-muted-foreground">
        {run.result.saved ? "저장됨" : `저장 안 됨: ${run.result.saveError}`}
        {run.result.failures.length > 0 && ` · 실패 ${run.result.failures.map((f) => f.seed.trim()).join(", ")}`}
      </p>
    );
  if (run.status === "error") return <p className="text-risk-high">{run.message}</p>;
  return null;
}

/**
 * 미래 트렌드
 * - 성분: Google Trends로 「카테고리 + 성분」 검색어의 검색 관심도 순위 (일본, 최근 3개월)
 * - 피부 고민·새 검색어: Google 자동완성에 나오는 말의 추세
 */
export function SearchTrendCard({ initial }: { initial: SearchSnap[] }) {
  const [snaps, setSnaps] = useState(initial);
  const [category, setCategory] = useState<string>(TRENDS_CATEGORIES[0]);
  const [interestRun, setInterestRun] = useState<RunState>({ status: "idle" });
  const [autoRun, setAutoRun] = useState<RunState>({ status: "idle" });

  const ranking = ingredientInterestRanking(snaps, category);
  const stats = searchTrendStats(snaps);

  async function collectInterest() {
    setInterestRun({ status: "running" });
    const r = await postJson("/api/trends/search-interest", { category });
    if (!r.ok) return setInterestRun({ status: "error", message: r.message });
    setSnaps((s) => [...s, ...r.result.snapshots]);
    setInterestRun({ status: "done", result: r.result });
  }

  async function collectAutocomplete() {
    setAutoRun({ status: "running" });
    const r = await postJson("/api/trends/autocomplete");
    if (!r.ok) return setAutoRun({ status: "error", message: r.message });
    setSnaps((s) => [...s, ...r.result.snapshots]);
    setAutoRun({ status: "done", result: r.result });
  }

  const termRow = (s: SearchTermStat) => (
    <li key={s.key} className="flex items-center justify-between gap-2 px-2 py-1 text-sm">
      <span lang="ja">{s.label}</span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="text-xs text-muted-foreground">{s.latest}</span>
        <Momentum stat={s} />
      </span>
    </li>
  );

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">성분 검색 관심도 순위</p>
          <ToggleGroup label="카테고리" options={TRENDS_CATEGORIES} value={category} onChange={setCategory} />
        </div>
        {ranking.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">이 카테고리는 아직 수집하지 않았어요</p>
        ) : (
          <ol className="divide-y rounded-md border">
            {ranking.rows.map((r) => (
              <li key={r.term} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-6 text-right font-semibold">{r.rank}</span>
                  <span lang="ja">{r.term}</span>
                  {r.canonical && INGREDIENT_MATCH[r.canonical] && <span className="text-xs text-muted-foreground">{INGREDIENT_MATCH[r.canonical].ko}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground">관심도 {r.interest}</span>
                  <RankChange row={r} hasPrev={ranking.hasPrev} />
                </span>
              </li>
            ))}
          </ol>
        )}
        <div className="space-y-1 text-xs">
          <Button size="sm" variant="outline" disabled={interestRun.status === "running"} onClick={collectInterest}>
            {interestRun.status === "running" ? "검색 관심도 수집 중…" : `${category} 검색 관심도 지금 수집`}
          </Button>
          <RunStatus run={interestRun} />
          <p className="text-muted-foreground">
            Google Trends (일본, 최근 3개월 평균) · 「{category} + 성분」 검색어끼리 비교한 상대값, 1위 = 100 · 실제 검색 횟수가 아니라 비율이에요
            {ranking.capturedAt && ` · 수집 ${formatDate(ranking.capturedAt)}`} · ▲▼ = 직전 수집 대비 순위 (샘플)
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-sm font-medium">피부 고민</p>
            <ul>{stats.concerns.map(termRow)}</ul>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">최근 새로 나온 검색어</p>
            {stats.newTerms.length === 0 ? <p className="text-xs text-muted-foreground">없어요</p> : <ul>{stats.newTerms.map(termRow)}</ul>}
            <p className="mt-1 text-xs text-muted-foreground">사전에 없는 말이라 해석하지 않고 그대로 보여줘요</p>
          </div>
        </div>
        <div className="space-y-1 text-xs">
          <Button size="sm" variant="outline" disabled={autoRun.status === "running"} onClick={collectAutocomplete}>
            {autoRun.status === "running" ? "자동완성 수집 중…" : "자동완성 지금 수집"}
          </Button>
          <RunStatus run={autoRun} />
          <p className="text-muted-foreground">
            Google 자동완성 (일본) · 시드 「{AUTOCOMPLETE_SEEDS.map((s) => s.trim()).join("」「")}」 · {stats.weeks}회 수집
            {stats.lastCaptured && ` · 마지막 ${formatDate(stats.lastCaptured)}`} · 점수 = 자동완성 순위 가중치 합 (1위 1.0 … 10위 0.1) · ▲▼ = {stats.compareWeeks}주 전 대비 (샘플)
          </p>
        </div>
      </section>
    </div>
  );
}
