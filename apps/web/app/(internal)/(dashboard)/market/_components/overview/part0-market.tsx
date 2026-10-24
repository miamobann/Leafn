"use client";

import { EmptyState } from "@/components/common/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Product } from "@/lib/schemas/product";
import type { TrendSnapshot } from "@/lib/schemas/trend";
import { TOP_N, weekLabel } from "@/app/(internal)/(dashboard)/market/_lib/market";
import { kbeautyShare, priceMap, risers, rowsAt, top10 } from "@/app/(internal)/(dashboard)/market/_lib/overview";
import { PriceMapChart, TrendLineChart } from "@/app/(internal)/(dashboard)/market/_components/charts";
import { ProductLabel, type PanelContent } from "./side-panel";

// 가격 포지셔닝 맵 읽는 법 (가운데 점선 = 각 축의 중앙값)
const QUADRANTS = [
  { where: "왼쪽 위", text: "판매가는 낮은데 ml당은 비쌈 → 용량을 줄여 장바구니 가격을 낮춘 진입형" },
  { where: "오른쪽 아래", text: "판매가는 높은데 ml당은 쌈 → 대용량·1+1·세트로 가성비를 보여 주는 형" },
  { where: "왼쪽 아래", text: "판매가·ml당 모두 낮음 → 가격 경쟁이 가장 센 자리" },
  { where: "오른쪽 위", text: "판매가·ml당 모두 높음 → 프리미엄. 가격을 설명할 근거가 필요" },
];
const PRICE_RULE = "판매가 = 평시가(税込). ml당 실질 가격 = 판매가 ÷ (용량 + 같은 제품 추가분: 1+1, 같은 제품 미니 증정). 할인율 프로모션은 판매가에 반영하지 않아요";

/** PART 0. 시장 개관: K-뷰티 비중 추이 · 급상승 상품 · 가격 포지셔닝 맵 · (팀 회의 후) 매트릭스 */
export function MarketPart({
  series,
  platformLabel,
  products,
  onOpen,
}: {
  series: TrendSnapshot[];
  platformLabel: string;
  products: Product[];
  onOpen: (c: PanelContent) => void;
}) {
  if (series.length === 0) return <EmptyState message="이 플랫폼·카테고리의 랭킹 데이터가 없어요" />;

  const share = kbeautyShare(series);
  const latestRows = rowsAt(series, series.length - 1);
  const up = risers(latestRows);
  const map = priceMap(top10(latestRows), products, series[0].category);
  const promoCount = map.points.filter((p) => p.promo).length;
  const toDot = (p: (typeof map.points)[number]) => ({ id: p.id, label: p.label, x: p.price, y: p.ppm, promo: p.promo });
  const openPoint = (id: string) => {
    const p = map.points.find((x) => x.id === id);
    if (p?.row) onOpen({ kind: "product", row: p.row });
  };

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
          <CardTitle>가격 포지셔닝 맵 · 판매가 × ml당 실질 가격 (Top {TOP_N})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">
            장바구니에서 느끼는 가격(판매가)과 실제 용량 대비 가격(ml당)의 차이를 봐요 · 프로모션 진행 중 <span className="font-semibold">{promoCount}/{map.points.length}</span>
          </p>
          {map.points.length === 0 ? (
            <EmptyState message="용량 정보가 있는 제품이 없어 맵을 그릴 수 없어요" />
          ) : (
            <PriceMapChart
              plain={map.points.filter((p) => !p.promo).map(toDot)}
              promo={map.points.filter((p) => p.promo).map(toDot)}
              own={map.own.map(toDot)}
              medianX={map.medianPrice}
              medianY={map.medianPpm}
              onSelect={openPoint}
            />
          )}
          <ul className="grid gap-1 text-xs text-muted-foreground md:grid-cols-2">
            {QUADRANTS.map((q) => (
              <li key={q.where}>
                <span className="font-medium text-foreground">{q.where}</span> · {q.text}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            {PRICE_RULE} · 점을 누르면 제품 요약 · 자사(마름모)는 현재 정가 기준{map.unplaced.length > 0 ? ` · 용량 정보가 없어 빠진 제품 ${map.unplaced.length}개` : ""}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>가격 전략 매트릭스</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState message="팀 회의에서 축과 칸을 정한 뒤 추가해요" action="다음 단계" />
        </CardContent>
      </Card>
    </div>
  );
}
