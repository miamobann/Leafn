"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { CONCERN_SEEDS, TRENDS_CATEGORIES } from "@/lib/external/search-terms";
import { AutocompleteRunResult, type SearchSnap } from "@/lib/schemas/search";
import { INGREDIENT_MATCH, ingredientInterestRanking, type InterestRow } from "@/app/(internal)/(dashboard)/market/_lib/market";

type RunState = { status: "idle" } | { status: "running" } | { status: "done"; result: AutocompleteRunResult } | { status: "error"; message: string };

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
 * 성분 검색 관심도 순위 + 수집 버튼 (시장 분석 원페이지 · 소비자 트렌드).
 * 「카테고리 + 성분」 검색어끼리 비교한 검색 관심도 (일본, 최근 3개월). 카테고리는 원페이지 조건 바를 따른다.
 * 자동완성 변화 목록은 원페이지 2-A가 보여 주고, 여기서는 지금 수집 버튼만 둔다.
 * 검색 데이터는 원페이지가 한 벌로 들고 있어서, 수집하면 onCollected로 올려 2-A·요약도 바로 바뀐다
 */
export function SearchTrendCard({ snaps, category, onCollected }: { snaps: SearchSnap[]; category: string; onCollected: (added: SearchSnap[]) => void }) {
  const supported = (TRENDS_CATEGORIES as readonly string[]).includes(category);
  const [interestRun, setInterestRun] = useState<RunState>({ status: "idle" });
  const [autoRun, setAutoRun] = useState<RunState>({ status: "idle" });

  const ranking = ingredientInterestRanking(snaps, category);

  async function collectInterest() {
    setInterestRun({ status: "running" });
    const r = await postJson("/api/trends/search-interest", { category });
    if (!r.ok) return setInterestRun({ status: "error", message: r.message });
    onCollected(r.result.snapshots);
    setInterestRun({ status: "done", result: r.result });
  }

  async function collectAutocomplete() {
    setAutoRun({ status: "running" });
    const r = await postJson("/api/trends/autocomplete");
    if (!r.ok) return setAutoRun({ status: "error", message: r.message });
    onCollected(r.result.snapshots);
    setAutoRun({ status: "done", result: r.result });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <p className="text-sm font-medium">성분 검색 관심도 순위 · {category}</p>
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
                  <span className="text-xs text-muted-foreground">{r.share}%</span>
                  <RankChange row={r} hasPrev={ranking.hasPrev} />
                </span>
              </li>
            ))}
          </ol>
        )}
        <div className="space-y-1 text-xs">
          <Button size="sm" variant="outline" disabled={!supported || interestRun.status === "running"} onClick={collectInterest}>
            {interestRun.status === "running" ? "검색 관심도 수집 중…" : `${category} 검색 관심도 지금 수집`}
          </Button>
          <RunStatus run={interestRun} />
          <p className="text-muted-foreground">
            검색 관심도 (일본, 최근 3개월 평균) · 「{category} + 성분」 검색어 전체 관심도 중 각 성분의 비율 (합 100%) · 실제 검색 횟수가 아니라 비율이에요
            {ranking.excluded.length > 0 && ` · 검색이 너무 적어 뺀 성분: ${ranking.excluded.join(", ")}`}
            {ranking.capturedAt && ` · 수집 ${formatDate(ranking.capturedAt)}`}
            {ranking.hasPrev ? " · ▲▼ = 직전 수집 대비 순위" : " · 다음 수집부터 직전 대비 ▲▼가 보여요"}
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <div className="space-y-1 text-xs">
          <Button size="sm" variant="outline" disabled={autoRun.status === "running"} onClick={collectAutocomplete}>
            {autoRun.status === "running" ? "자동완성 수집 중…" : "자동완성 지금 수집"}
          </Button>
          <RunStatus run={autoRun} />
          <p className="text-muted-foreground">
            검색 추천어 (일본) · 고민 단어 「{CONCERN_SEEDS.map((s) => s.seed.trim()).join("」「")}」 · 한 번에 {CONCERN_SEEDS.length}번 호출 · 결과는 위 「피부 고민별 검색 추천어」에 바로 반영돼요
          </p>
        </div>
      </section>
    </div>
  );
}
