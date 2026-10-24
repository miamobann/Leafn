"use client";

import { EmptyState } from "@/components/common/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TrendSnapshot } from "@/lib/schemas/trend";
import { TOP_N, weekLabel } from "@/app/(internal)/(dashboard)/market/_lib/market";
import { kbeautyShare, risers, rowsAt, top10 } from "@/app/(internal)/(dashboard)/market/_lib/overview";
import { TrendLineChart } from "@/app/(internal)/(dashboard)/market/_components/charts";
import { RankingDynamics } from "@/app/(internal)/(dashboard)/market/_components/ranking-dynamics";
import { ProductLabel, type PanelContent } from "./side-panel";

/** PART 0. 시장 개관: K-뷰티 비중 추이 · 급상승 상품 · 랭킹 역동성 */
export function MarketPart({ series, platformLabel, onOpen }: { series: TrendSnapshot[]; platformLabel: string; onOpen: (c: PanelContent) => void }) {
  if (series.length === 0) return <EmptyState message="이 플랫폼·카테고리의 랭킹 데이터가 없어요" />;

  const share = kbeautyShare(series);
  const first = share[0];
  const last = share.at(-1) ?? first;
  const up = risers(rowsAt(series, series.length - 1));

  const openWeek = (i: number) => {
    const point = share[i];
    if (!point) return;
    onOpen({
      kind: "list",
      title: `${point.week} 주 Top ${TOP_N}`,
      description: `K-뷰티 ${point.count}/${TOP_N} · ${platformLabel}`,
      rows: top10(rowsAt(series, i)).map((row) => ({ row, note: row.is_kbeauty ? "K-뷰티" : "K-뷰티 아님" })),
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm">
        이번 주 Top {TOP_N} 중 K-뷰티 <span className="text-xl font-semibold">{last.count}/{TOP_N}</span>
        {share.length > 1 ? (
          <span className="ml-2 text-muted-foreground">
            ({share.length}주 전 {first.count}/{TOP_N} → {last.count - first.count >= 0 ? `+${last.count - first.count}` : last.count - first.count}개)
          </span>
        ) : (
          <span className="ml-2 text-muted-foreground">(비교할 이전 주가 없어요)</span>
        )}
      </p>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top {TOP_N} 중 K-뷰티 비중 · {share.length}주</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendLineChart
              data={share.map((p) => ({ week: p.week, share: p.share }))}
              series={[{ key: "share", label: "K-뷰티 비중", color: "var(--primary)", emphasis: true }]}
              unit="%"
              domain={[0, 100]}
              height={220}
              onPointClick={openWeek}
            />
            <p className="mt-1 text-xs text-muted-foreground">주를 누르면 그 주 Top {TOP_N} 목록이 열려요 · K-뷰티 = 한국 브랜드 제품 (샘플 표시값)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>급상승 상품 · 전주 대비</CardTitle>
          </CardHeader>
          <CardContent>
            {up.length === 0 ? (
              <p className="text-sm text-muted-foreground">{series.length < 2 ? "전주 데이터가 없어 비교할 수 없어요" : "순위가 오른 제품이 없어요"}</p>
            ) : (
              <ul className="divide-y">
                {up.map((r) => (
                  <li key={`${r.brand}|${r.name}`}>
                    <button type="button" className="flex w-full items-start gap-2 py-2 text-left text-sm hover:bg-muted" onClick={() => onOpen({ kind: "product", row: r })}>
                      <span className="w-14 shrink-0 text-xs font-medium text-risk-low">▲ {r.delta}</span>
                      <span className="min-w-0 flex-1">
                        <ProductLabel row={r} />
                        <span className="text-xs text-muted-foreground">
                          {r.prevRank}위 → {r.rank}위
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted-foreground">{weekLabel(series[series.length - 1].captured_at)} 주 20위 안 · 새로 들어온 제품은 공급 섹션의 신규 진입에서 봐요</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>랭킹 역동성 · Top 20 교체율</CardTitle>
        </CardHeader>
        <CardContent>
          <RankingDynamics snapshots={series} category={series[0].category} platformLabel={`${platformLabel} ランキング`} />
        </CardContent>
      </Card>
    </div>
  );
}
