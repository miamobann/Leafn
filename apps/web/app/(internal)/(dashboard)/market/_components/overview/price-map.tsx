"use client";

import { useState } from "react";
import { HelpTip } from "@/components/common/help-tip";
import { EmptyState } from "@/components/common/states";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import type { Product } from "@/lib/schemas/product";
import type { TrendSnapshot } from "@/lib/schemas/trend";
import { priceMap, rowsAt, type PriceMode, type PricePoint } from "@/app/(internal)/(dashboard)/market/_lib/overview";
import { PriceMapChart } from "@/app/(internal)/(dashboard)/market/_components/charts";
import { ToggleGroup } from "@/app/(internal)/(dashboard)/market/_components/toggle-group";
import type { PanelContent } from "./side-panel";

// 화면 문구
const MODES = ["정가 기준", "할인 적용가 기준"] as const;
const MODE_KEY: Record<(typeof MODES)[number], PriceMode> = { "정가 기준": "list", "할인 적용가 기준": "sale" };

// 맵 읽는 법 (가운데 점선 = 각 축의 중앙값)
const QUADRANTS = [
  { where: "왼쪽 위", text: "판매가는 낮은데 ml당은 비쌈 → 용량을 줄여 장바구니 가격을 낮춘 진입형" },
  { where: "오른쪽 아래", text: "판매가는 높은데 ml당은 쌈 → 대용량·1+1·세트로 가성비를 보여 주는 형" },
  { where: "왼쪽 아래", text: "판매가·ml당 모두 낮음 → 가격 경쟁이 가장 센 자리" },
  { where: "오른쪽 위", text: "판매가·ml당 모두 높음 → 프리미엄. 가격을 설명할 근거가 필요" },
];
const RULE = {
  list: "판매가 = 정가(税込). ml당 = 정가 ÷ (용량 + 같은 제품 추가분: 1+1, 같은 제품 미니 증정)",
  sale: "판매가 = 할인 적용가(税込, 할인이 없으면 정가). ml당 = 할인 적용가 ÷ (용량 + 같은 제품 추가분). 자사는 정가 그대로",
};

/**
 * 플랫폼 분석 1-B 가격 포지셔닝 맵 [심리적 가격 저항선 × 실질 가치].
 * 2026-10-25: 시장 개관 탭을 없애며 플랫폼 분석으로 옮겼고, 가격 전략 매트릭스는 폐지했다
 */
export function PriceMapSection({
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
  const [modeLabel, setModeLabel] = useState<(typeof MODES)[number]>("정가 기준");
  if (series.length === 0) return <EmptyState message="이 플랫폼·카테고리의 랭킹 데이터가 없어요" />;

  // 가격 전략은 순위권 전체(20위까지)를 본다. 세트 상품처럼 용량을 모르는 제품은 맵에서 빠진다
  const top = rowsAt(series, series.length - 1);
  const probe = priceMap(top, products, series[0].category, "list");
  // 할인 데이터가 없는 플랫폼(지금 楽天 샘플)은 정가 기준만
  const mode: PriceMode = probe.hasDiscount ? MODE_KEY[modeLabel] : "list";
  const map = mode === "list" ? probe : priceMap(top, products, series[0].category, mode);
  const toDot = (p: PricePoint) => ({ id: p.id, label: p.label, x: p.price, y: p.ppm, listPrice: p.listPrice, salePrice: p.salePrice, discountRate: p.discountRate, promo: p.promo });
  const openPoint = (id: string) => {
    const p = map.points.find((x) => x.id === id);
    if (p?.row) onOpen({ kind: "product", row: p.row });
  };

  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        1-B 가격 포지셔닝 맵 · 판매가 × ml당 가격 ({platformLabel} Top {top.length})
        <HelpTip label="맵 읽는 법">
          <span className="block">가운데 점선 = 각 축의 중앙값. 점을 누르면 제품 요약이 열려요.</span>
          {QUADRANTS.map((q) => (
            <span key={q.where} className="block">
              <b>{q.where}</b> · {q.text}
            </span>
          ))}
          <span className="block">{RULE[mode]}</span>
        </HelpTip>
      </h3>
      <Card>
        <CardContent>
          {map.points.length === 0 ? (
            <EmptyState message="용량 정보가 있는 제품이 없어 맵을 그릴 수 없어요" />
          ) : (
            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <PriceMapChart
                plain={map.points.filter((p) => !p.onPromo).map(toDot)}
                promo={map.points.filter((p) => p.onPromo).map(toDot)}
                own={map.own.map(toDot)}
                medianX={map.medianPrice}
                medianY={map.medianPpm}
                domainX={map.domainX}
                domainY={map.domainY}
                priceLabel={mode === "sale" ? "판매가 (할인 적용가)" : "판매가 (정가)"}
                onSelect={openPoint}
                height={340}
              />
              <div className="space-y-3 text-sm">
                <div className="space-y-1">
                  <ToggleGroup label="보기" options={MODES} value={probe.hasDiscount ? modeLabel : "정가 기준"} onChange={setModeLabel} />
                  {!probe.hasDiscount && <p className="text-xs text-muted-foreground">할인 데이터가 없어 정가 기준만 볼 수 있어요</p>}
                </div>
                {/* 숫자 몇 개를 바로 읽는 용도라 그래프 대신 표 */}
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="text-muted-foreground">할인 중인 제품</TableCell>
                      <TableCell className="text-right font-medium">
                        {map.discountedCount}/{map.points.length}
                        {map.medianRate !== null && <span className="ml-1 text-xs font-normal text-muted-foreground">(중앙값 {map.medianRate}%)</span>}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground">판매가 중앙값 ({mode === "sale" ? "할인 적용" : "정가"})</TableCell>
                      <TableCell className="text-right font-medium">{map.medianPrice !== null ? `¥${map.medianPrice.toLocaleString("ja-JP")}` : "—"}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground">ml당 중앙값 ({mode === "sale" ? "할인 적용" : "정가"})</TableCell>
                      <TableCell className="text-right font-medium">{map.medianPpm !== null ? `${map.medianPpm}円` : "—"}</TableCell>
                    </TableRow>
                    {map.ownCheaperThan.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="whitespace-normal text-muted-foreground">{o.name.replace("자사 ", "자사 · ")}</TableCell>
                        <TableCell className="text-right font-medium">
                          ml당 {o.ppm}円
                          <span className="block text-xs font-normal text-muted-foreground">
                            {map.points.length}개 중 {o.cheaper}개가 더 쌈
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {map.unplaced.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    용량을 알 수 없어 빠진 세트 등 {map.unplaced.length}개 ({map.unplaced.map((r) => `${r.rank}위`).join(", ")})
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
