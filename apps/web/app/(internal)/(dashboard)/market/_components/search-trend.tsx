"use client";

import { useState } from "react";
import { HelpTip } from "@/components/common/help-tip";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { CONCERN_SEEDS, TRENDS_CATEGORIES } from "@/lib/external/search-terms";
import { AutocompleteRunResult, type SearchSnap } from "@/lib/schemas/search";
import { INGREDIENT_MATCH, ingredientInterestRanking, type InterestRow } from "@/app/(internal)/(dashboard)/market/_lib/market";
import { ShareDonut } from "@/app/(internal)/(dashboard)/market/_components/charts";

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
 * 검색 데이터 수집 버튼 줄 (소비자 트렌드 탭 맨 위). 성분 검색 관심도(Google Trends)와 자동완성(피부 고민별 추천어)을 SerpApi로 모은다.
 * 검색 데이터는 원페이지가 한 벌로 들고 있어서, 수집하면 onCollected로 올려 2-A·성분 관심도·요약이 바로 바뀐다
 */
export function SearchCollectBar({ category, onCollected }: { category: string; onCollected: (added: SearchSnap[]) => void }) {
  const supported = (TRENDS_CATEGORIES as readonly string[]).includes(category);
  const [interestRun, setInterestRun] = useState<RunState>({ status: "idle" });
  const [autoRun, setAutoRun] = useState<RunState>({ status: "idle" });

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
    <div className="flex flex-wrap items-start gap-x-8 gap-y-2 rounded-lg border bg-card px-3 py-2 text-xs">
      <div className="space-y-1">
        <span className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" disabled={!supported || interestRun.status === "running"} onClick={collectInterest}>
            {interestRun.status === "running" ? "검색 관심도 수집 중…" : `${category} 검색 관심도 지금 수집`}
          </Button>
          <HelpTip>Google Trends (일본, 최근 3개월) · 결과는 아래 「성분 검색 관심도」에 반영 · 유료 SerpApi 3번 호출</HelpTip>
        </span>
        <RunStatus run={interestRun} />
      </div>
      <div className="space-y-1">
        <span className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" disabled={autoRun.status === "running"} onClick={collectAutocomplete}>
            {autoRun.status === "running" ? "자동완성 수집 중…" : "자동완성 지금 수집"}
          </Button>
          <HelpTip>
            구글 검색 추천어 (일본) · 고민 단어 「{CONCERN_SEEDS.map((s) => s.seed.trim()).join("」「")}」 · 결과는 아래 「피부 고민별 검색 추천어」에 반영 · 유료 SerpApi {CONCERN_SEEDS.length}번 호출
          </HelpTip>
        </span>
        <RunStatus run={autoRun} />
      </div>
    </div>
  );
}

/** 성분 검색 관심도 순위 (「카테고리 + 성분」 검색어끼리 비교, 일본, 최근 3개월). 카테고리는 원페이지 조건 바를 따른다 */
export function IngredientInterestCard({ snaps, category }: { snaps: SearchSnap[]; category: string }) {
  const ranking = ingredientInterestRanking(snaps, category);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          성분 검색 관심도 · {category}
          <HelpTip>
            <span className="block">Google Trends (일본, 최근 3개월 평균) · 「{category} + 성분」 검색어 전체 관심도 중 각 성분의 비율 (합 100%). 실제 검색 횟수가 아니라 비율이에요.</span>
            {ranking.excluded.length > 0 && <span className="block">검색이 너무 적어 뺀 성분: {ranking.excluded.join(", ")}</span>}
            <span className="block">{ranking.hasPrev ? "▲▼ = 직전 수집 대비 순위" : "다음 수집부터 직전 대비 ▲▼가 보여요"}</span>
          </HelpTip>
          {ranking.capturedAt && <span className="text-xs font-normal text-muted-foreground">수집 {formatDate(ranking.capturedAt)}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {ranking.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">이 카테고리는 아직 수집하지 않았어요 · 위 [검색 관심도 지금 수집]을 눌러 주세요</p>
        ) : (
          <ShareDonut
            items={ranking.rows.map((r) => {
              const ko = r.canonical ? INGREDIENT_MATCH[r.canonical]?.ko : undefined;
              return { id: r.term, label: ko ?? r.term, hint: ko ? r.term : undefined, value: r.share, extra: ranking.hasPrev && r.prevRank !== r.rank ? <RankChange row={r} hasPrev /> : undefined };
            })}
          />
        )}
      </CardContent>
    </Card>
  );
}
