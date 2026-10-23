"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReportTemplate } from "@/components/templates";
import { formatDate, formatJpy } from "@/lib/format";
import type { Product } from "@/lib/schemas/product";
import type { SearchSnap } from "@/lib/schemas/search";
import { AppealRunResult, type TrendSnapshot, type TrendSource } from "@/lib/schemas/trend";
import { SearchTrendCard } from "@/app/(internal)/(dashboard)/market/_components/search-trend";
import {
  compareHeroStats,
  heroIngredientStats,
  INGREDIENT_MATCH,
  ownIngredients,
  TOP_N,
  type HeroIngredientStat,
} from "@/app/(internal)/(dashboard)/market/_lib/market";

const CATEGORY = "化粧水";
const SOURCES: { key: TrendSource; label: string }[] = [
  { key: "rakuten_ranking", label: "楽天" },
  { key: "qoo10_ranking", label: "Qoo10" },
];

type Snap = Pick<TrendSnapshot, "source" | "category" | "captured_at" | "data">;
type RunState = { status: "idle" } | { status: "running" } | { status: "done"; result: AppealRunResult } | { status: "error"; message: string };

function analyzedInfo(s: Snap | undefined) {
  const analyzed = s?.data.ranking.filter((r) => r.rank <= TOP_N && r.appeal) ?? [];
  const model = analyzed[0]?.appeal?.model;
  const rejected = analyzed.reduce((sum, r) => sum + (r.appeal?.rejected_count ?? 0), 0);
  return { count: analyzed.length, model, rejected };
}

function Cell({ stat }: { stat: HeroIngredientStat | null }) {
  if (!stat) return <TableCell className="text-right text-muted-foreground">—</TableCell>;
  return (
    <TableCell className="text-right">
      <span className="font-semibold">{stat.count}개</span> <span className="text-xs text-muted-foreground">{formatJpy(stat.avgPrice)}</span>
    </TableCell>
  );
}

export function AppealReport({ initial, searchInitial, products }: { initial: Partial<Record<TrendSource, Snap>>; searchInitial: SearchSnap[]; products: Product[] }) {
  const [snaps, setSnaps] = useState(initial);
  const [runs, setRuns] = useState<Partial<Record<TrendSource, RunState>>>({});
  const own = ownIngredients(products);

  const rakuten = heroIngredientStats(snaps.rakuten_ranking);
  const qoo10 = heroIngredientStats(snaps.qoo10_ranking);
  const rows = compareHeroStats(rakuten, qoo10);

  async function run(source: TrendSource) {
    setRuns((s) => ({ ...s, [source]: { status: "running" } }));
    try {
      const res = await fetch("/api/trends/appeal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, category: CATEGORY }),
      });
      const body: unknown = await res.json();
      if (!res.ok) {
        const message = typeof body === "object" && body && "error" in body && typeof body.error === "string" ? body.error : `오류 (${res.status})`;
        setRuns((s) => ({ ...s, [source]: { status: "error", message } }));
        return;
      }
      const result = AppealRunResult.parse(body);
      setSnaps((s) => ({ ...s, [source]: result.snapshot }));
      setRuns((s) => ({ ...s, [source]: { status: "done", result } }));
    } catch (e) {
      setRuns((s) => ({ ...s, [source]: { status: "error", message: e instanceof Error ? e.message : "요청 실패" } }));
    }
  }

  return (
    <ReportTemplate
      state={rows.length === 0 ? "empty" : undefined}
      filters={
        <div className="flex flex-wrap items-start gap-4">
          {SOURCES.map(({ key, label }) => {
            const info = analyzedInfo(snaps[key]);
            const state = runs[key] ?? { status: "idle" };
            return (
              <div key={key} className="space-y-1 text-xs">
                <Button size="sm" variant="outline" disabled={state.status === "running"} onClick={() => run(key)}>
                  {state.status === "running" ? `${label} 분석 중…` : `${label} 이미지 다시 분석`}
                </Button>
                <p className="text-muted-foreground">
                  {snaps[key] ? `${formatDate(snaps[key].captured_at)} 랭킹 · ${info.count}개 분석${info.model ? ` · ${info.model}` : ""}` : "데이터 없음"}
                  {info.rejected > 0 && ` · 원문에 없어 버린 항목 ${info.rejected}개`}
                </p>
                {state.status === "done" && (
                  <p className="text-muted-foreground">
                    {state.result.saved ? "저장됨" : `저장 안 됨: ${state.result.saveError}`}
                    {state.result.failures.length > 0 && ` · 실패 ${state.result.failures.map((f) => `${f.rank}위(${f.error})`).join(", ")}`}
                  </p>
                )}
                {state.status === "error" && <p className="text-risk-high">{state.message}</p>}
              </div>
            );
          })}
        </div>
      }
      cards={[
        {
          title: `현재 트렌드 · ${CATEGORY} 상위 ${TOP_N} 소구 성분 (楽天 vs Qoo10)`,
          content: (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>성분</TableHead>
                    <TableHead className="text-right">楽天</TableHead>
                    <TableHead className="text-right">Qoo10</TableHead>
                    <TableHead>구분</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.ingredient}>
                      <TableCell>
                        <span lang="ja">{own.has(r.ingredient) ? `★ ${r.ingredient}` : r.ingredient}</span>
                        {INGREDIENT_MATCH[r.ingredient] && <span className="text-xs text-muted-foreground"> {INGREDIENT_MATCH[r.ingredient].ko}</span>}
                      </TableCell>
                      <Cell stat={r.rakuten} />
                      <Cell stat={r.qoo10} />
                      <TableCell>
                        {r.rakuten && r.qoo10 ? <Badge>공통</Badge> : <Badge variant="outline">{r.rakuten ? "楽天만" : "Qoo10만"}</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-2 text-xs text-muted-foreground">
                숫자 = 그 성분을 이미지에서 전면에 내세운 제품 수 · 회색 = 평균 税込 가격 · 출처별로 따로 세고 제품끼리 합치지 않아요 · ★ = 자사 제품에 든 성분 (샘플 이미지)
              </p>
            </>
          ),
        },
        {
          title: "미래 트렌드 · 소비자 검색 관심 추세",
          content: <SearchTrendCard initial={searchInitial} />,
        },
      ]}
    />
  );
}
