"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { AUTOCOMPLETE_SEEDS } from "@/lib/external/search-terms";
import { AutocompleteRunResult, type SearchSnap } from "@/lib/schemas/search";
import { INGREDIENT_MATCH, searchTrendStats, type SearchTermStat } from "@/app/(internal)/(dashboard)/market/_lib/market";
import { TrendLineChart } from "@/app/(internal)/(dashboard)/market/_components/charts";

type RunState = { status: "idle" } | { status: "running" } | { status: "done"; result: AutocompleteRunResult } | { status: "error"; message: string };

function Momentum({ stat }: { stat: SearchTermStat }) {
  if (stat.status === "new") return <Badge>NEW</Badge>;
  if (stat.status === "up") return <span className="text-xs font-medium text-risk-low">▲ {stat.delta}</span>;
  if (stat.status === "down") return <span className="text-xs font-medium text-risk-high">▼ {-stat.delta}</span>;
  return <span className="text-xs text-muted-foreground">–</span>;
}

/** 미래 트렌드: Google 자동완성(일본)에 성분·피부 고민이 얼마나 자주, 얼마나 위에 나오는지의 주별 추세 */
export function SearchTrendCard({ initial }: { initial: SearchSnap[] }) {
  const [snaps, setSnaps] = useState(initial);
  const [run, setRun] = useState<RunState>({ status: "idle" });
  const stats = searchTrendStats(snaps);
  const [selectedKey, setSelectedKey] = useState("");
  const selected = [...stats.ingredients, ...stats.concerns, ...stats.newTerms].find((s) => s.key === selectedKey) ?? stats.ingredients[0];
  const lastCaptured = snaps.at(-1)?.captured_at;

  async function collect() {
    setRun({ status: "running" });
    try {
      const res = await fetch("/api/trends/autocomplete", { method: "POST" });
      const body: unknown = await res.json();
      if (!res.ok) {
        const message = typeof body === "object" && body && "error" in body && typeof body.error === "string" ? body.error : `오류 (${res.status})`;
        setRun({ status: "error", message });
        return;
      }
      const result = AutocompleteRunResult.parse(body);
      setSnaps((s) => [...s, ...result.snapshots]);
      setRun({ status: "done", result });
    } catch (e) {
      setRun({ status: "error", message: e instanceof Error ? e.message : "요청 실패" });
    }
  }

  const row = (s: SearchTermStat) => (
    <li key={s.key}>
      <button
        type="button"
        onClick={() => setSelectedKey(s.key)}
        aria-pressed={s.key === selected?.key}
        className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted ${s.key === selected?.key ? "bg-muted" : ""}`}
      >
        <span>
          <span lang="ja">{s.label}</span>
          {s.kind === "ingredient" && INGREDIENT_MATCH[s.label] && <span className="text-xs text-muted-foreground"> {INGREDIENT_MATCH[s.label].ko}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted-foreground">{s.latest}</span>
          <Momentum stat={s} />
        </span>
      </button>
    </li>
  );

  return (
    <div className="space-y-4">
      <div className="space-y-1 text-xs">
        <Button size="sm" variant="outline" disabled={run.status === "running"} onClick={collect}>
          {run.status === "running" ? "자동완성 수집 중…" : "자동완성 지금 수집"}
        </Button>
        <p className="text-muted-foreground">
          Google 자동완성 (일본) · 시드 {AUTOCOMPLETE_SEEDS.length}개 「{AUTOCOMPLETE_SEEDS.map((s) => s.trim()).join("」「")}」 · {stats.weeks}회 수집
          {lastCaptured && ` · 마지막 ${formatDate(lastCaptured)}`}
        </p>
        {run.status === "done" && (
          <p className="text-muted-foreground">
            {run.result.saved ? "저장됨" : `저장 안 됨: ${run.result.saveError}`}
            {run.result.failures.length > 0 && ` · 실패 ${run.result.failures.map((f) => f.seed.trim()).join(", ")}`}
          </p>
        )}
        {run.status === "error" && <p className="text-risk-high">{run.message}</p>}
      </div>

      {selected && (
        <div>
          <p className="mb-1 text-sm font-medium">
            <span lang="ja">{selected.label}</span> · 자동완성 점수 추이
          </p>
          <TrendLineChart data={selected.series} series={[{ key: "score", label: selected.label, color: "var(--primary)", emphasis: true }]} height={160} />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-sm font-medium">성분</p>
          <ul>{stats.ingredients.map(row)}</ul>
        </div>
        <div className="space-y-4">
          <div>
            <p className="mb-1 text-sm font-medium">피부 고민</p>
            <ul>{stats.concerns.map(row)}</ul>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">최근 새로 나온 검색어</p>
            {stats.newTerms.length === 0 ? <p className="text-xs text-muted-foreground">없어요</p> : <ul>{stats.newTerms.map(row)}</ul>}
            <p className="mt-1 text-xs text-muted-foreground">사전에 없는 말이라 해석하지 않고 그대로 보여줘요</p>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        점수 = 자동완성 목록에 나온 순위 가중치 합 (1위 1.0 … 10위 0.1, 시드 합산) · ▲▼ = {stats.compareWeeks}주 전 대비 · 추천·드럭스토어·인기 같은 일반어는 뺐어요 · 항목을 눌러 추이 보기 (샘플)
      </p>
    </div>
  );
}
