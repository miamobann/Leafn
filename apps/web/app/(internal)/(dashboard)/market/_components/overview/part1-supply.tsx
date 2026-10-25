"use client";

import Link from "next/link";
import { useState } from "react";
import { LangBadge } from "@/components/common/badges";
import { EmptyState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatJpy } from "@/lib/format";
import { APPEAL_TAGS } from "@/lib/market-config";
import type { Product } from "@/lib/schemas/product";
import type { PromoEvent } from "@/lib/schemas/promo";
import type { TrendSnapshot } from "@/lib/schemas/trend";
import { INGREDIENT_MATCH, ownIngredients, PROMO_HOOK_LABEL, TOP_N } from "@/app/(internal)/(dashboard)/market/_lib/market";
import {
  ENTRY_KIND_LABEL,
  entryConditions,
  ingredientMentions,
  ingredientTrend,
  rowsAt,
  saleEventFor,
  tagShare,
  top10,
  type OverviewRow,
} from "@/app/(internal)/(dashboard)/market/_lib/overview";
import { HorizontalBarChart, TrendLineChart } from "@/app/(internal)/(dashboard)/market/_components/charts";
import { MAX_COMPARE, ProductLabel, RankChange, type PanelContent } from "./side-panel";

// 계산 기준 (카드·표 머리의 툴팁과 각주)
const DEFINITIONS = {
  ppm: "ml당 가격 = 판매가(税込, 정가) ÷ 총 용량. 총 용량에는 같은 제품의 리필·미니어처·1+1만 더하고 다른 제품 증정품은 더하지 않아요",
  promo: "Top 10 상품 페이지의 프로모션 문구를 형태별로 묶어 가장 많은 형태",
  entries: "전주 Top 10에 없던 제품 수. 20위 안에서 올라온 제품, 이미 랭킹에 있던 브랜드의 신상품, 처음 보는 브랜드로 나눠요",
  tags: "Top 10 상품명·설명에서 소구 태그 사전에 있는 표기만 세요",
  ingredients: "이번 주 20위 안 상품명·설명에 성분 사전의 표기가 나온 제품 수",
};

// 고정 열 너비·위치 (가로 스크롤해도 순위·상품명·ml당 단가가 보이게)
const STICKY = {
  check: "sticky left-0 z-10 w-10 min-w-10 bg-card",
  rank: "sticky left-10 z-10 w-12 min-w-12 bg-card",
  name: "sticky left-[88px] z-10 w-56 min-w-56 bg-card",
  ppm: "sticky left-[312px] z-10 w-[88px] min-w-[88px] border-r bg-card text-right",
};
// 1024px에서는 표에서 빼고 제품 요약 패널에서 본다
const WIDE_ONLY = "hidden xl:table-cell";

function ConditionCard({ title, definition, value, sub, onClick }: { title: string; definition: string; value: React.ReactNode; sub?: React.ReactNode; onClick?: () => void }) {
  return (
    <button type="button" disabled={!onClick} onClick={onClick} className="rounded-lg border bg-card p-3 text-left hover:bg-muted disabled:cursor-default disabled:hover:bg-card">
      <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        {title}
        <span title={definition} aria-label={`계산 방법: ${definition}`} className="cursor-help rounded border px-1">
          계산 방법
        </span>
      </span>
      <span className="mt-1 block text-xl font-semibold">{value}</span>
      {sub && <span className="block text-xs text-muted-foreground">{sub}</span>}
    </button>
  );
}

function volumeText(r: OverviewRow): string {
  if (!r.volume_ml) return "—";
  return r.extra_volume_ml ? `${r.volume_ml}+${r.extra_volume_ml}ml` : `${r.volume_ml}ml`;
}

export function SupplyPart({
  series,
  sameSource,
  platformLabel,
  platformName,
  promoEvents,
  products,
  selected,
  onToggleCompare,
  onOpen,
}: {
  series: TrendSnapshot[];
  /** 같은 플랫폼의 모든 카테고리 스냅샷 (새 브랜드 판정용) */
  sameSource: TrendSnapshot[];
  platformLabel: string;
  /** promo_events.platform 표기 (楽天市場·Qoo10) */
  platformName: string;
  promoEvents: PromoEvent[];
  products: Product[];
  selected: string[];
  onToggleCompare: (id: string) => void;
  onOpen: (c: PanelContent) => void;
}) {
  const [ingredient, setIngredient] = useState<string | null>(null);

  const latest = series.at(-1);
  const conditions = entryConditions(series, sameSource);
  if (!latest || !conditions) return <EmptyState message="이 플랫폼·카테고리의 랭킹 데이터가 없어요" />;

  const rows = rowsAt(series, series.length - 1);
  // 전주 데이터가 없으면(수집 1주차) 변동 칸과 신규 진입 카드를 숨긴다
  const hasPrev = series.length >= 2;
  const top = top10(rows);
  const nearTop = rows.filter((r) => r.rank > TOP_N);
  const sale = saleEventFor(latest.captured_at, platformName, promoEvents);
  const tags = tagShare(top);
  const mentions = ingredientMentions(rows);
  const own = ownIngredients(products);
  const activeIngredient = ingredient && mentions.some((m) => m.ingredient === ingredient) ? ingredient : (mentions[0]?.ingredient ?? null);
  const list = (title: string, description: string, items: { row: OverviewRow; note?: string }[]) => onOpen({ kind: "list", title, description, rows: items });
  const { ppm, promo, entries } = conditions;

  const rankRow = (r: OverviewRow) => {
    const checked = r.product_id ? selected.includes(r.product_id) : false;
    return (
      <TableRow key={`${r.brand}|${r.name}`} className="cursor-pointer" onClick={() => onOpen({ kind: "product", row: r })}>
        <TableCell className={STICKY.check} onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={checked}
            disabled={!r.product_id || (!checked && selected.length >= MAX_COMPARE)}
            onCheckedChange={() => r.product_id && onToggleCompare(r.product_id)}
            aria-label={`${r.brand} ${r.name} 비교에 추가`}
            title={r.product_id ? undefined : "등록되지 않은 제품이라 비교할 수 없어요"}
          />
        </TableCell>
        <TableCell className={`${STICKY.rank} font-semibold`}>{r.rank}</TableCell>
        <TableCell className={`${STICKY.name} whitespace-normal`}>
          <ProductLabel row={r} />
        </TableCell>
        <TableCell className={STICKY.ppm}>{r.ppm !== null ? `${r.ppm}円` : "—"}</TableCell>
        {hasPrev && (
          <TableCell>
            <RankChange row={r} />
          </TableCell>
        )}
        <TableCell>{r.brand}</TableCell>
        <TableCell>{r.is_kbeauty ? <Badge variant="secondary">K-뷰티</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
        <TableCell className="text-right">
          {formatJpy(r.price_jpy)}
          {sale && <span className="block text-xs text-muted-foreground">세일 주간</span>}
        </TableCell>
        <TableCell className="text-right">{volumeText(r)}</TableCell>
        <TableCell className={`${WIDE_ONLY} whitespace-normal`}>{r.ingredients.map((x) => INGREDIENT_MATCH[x.ingredient]?.ko ?? x.ingredient).join(", ") || "—"}</TableCell>
        <TableCell className={`${WIDE_ONLY} whitespace-normal`}>
          {[...r.tags.map((t) => APPEAL_TAGS[t.tag]?.ko ?? t.tag), ...(r.badges ?? [])].join(", ") || "—"}
        </TableCell>
        <TableCell className={WIDE_ONLY}>{r.promo_type ? PROMO_HOOK_LABEL[r.promo_type] : "—"}</TableCell>
        <TableCell className="text-right">
          {r.rating != null ? r.rating.toFixed(1) : "—"}
          <span className="block text-xs text-muted-foreground">{r.review_count !== null ? `${r.review_count.toLocaleString("ko-KR")}건` : "리뷰 수 없음"}</span>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-6">
      {/* 1-A 상위권 진입 조건 */}
      <div>
        <h3 className="mb-2 text-sm font-semibold">1-A 상위권 진입 조건 · Top {TOP_N}</h3>
        <div className={`grid gap-3 ${entries ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
          <ConditionCard
            title="ml당 가격 구간"
            definition={DEFINITIONS.ppm}
            value={ppm ? `${ppm.median}円/ml` : "—"}
            sub={ppm ? `사분위 ${ppm.q1}~${ppm.q3}円 · 판매가 ${formatJpy(ppm.priceMin)}~${formatJpy(ppm.priceMax)} (중앙값 ${formatJpy(ppm.priceMedian)})` : "용량 정보 없음"}
            onClick={ppm ? () => list("ml당 가격 · 낮은 순", DEFINITIONS.ppm, ppm.rows.map((row) => ({ row, note: `${row.ppm}円/ml · ${formatJpy(row.price_jpy)} / ${volumeText(row)}` }))) : undefined}
          />
          <ConditionCard
            title="주된 프로모션"
            definition={DEFINITIONS.promo}
            value={promo ? `${promo.count}/${TOP_N}` : "—"}
            sub={promo ? PROMO_HOOK_LABEL[promo.type] : "프로모션 표시 없음"}
            onClick={promo ? () => list(`프로모션 · ${PROMO_HOOK_LABEL[promo.type]}`, DEFINITIONS.promo, promo.rows.map((row) => ({ row, note: row.promo_text ?? undefined }))) : undefined}
          />
          {entries && (
            <ConditionCard
              title="신규 진입"
              definition={DEFINITIONS.entries}
              value={entries ? `${entries.count}/${TOP_N}` : "—"}
              sub={
                entries
                  ? `20위 안에서 ${entries.byKind.rose} · 기존 브랜드 신상품 ${entries.byKind.brand_new_product} · 새 브랜드 ${entries.byKind.new_brand}`
                  : "전주 데이터가 없어 비교할 수 없어요"
              }
              onClick={entries && entries.count > 0 ? () => list("전주 Top 10에 없던 제품", DEFINITIONS.entries, entries.rows.map((row) => ({ row, note: ENTRY_KIND_LABEL[row.entryKind] }))) : undefined}
            />
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">카드를 누르면 계산에 쓴 제품 목록이 열려요</p>
      </div>

      {/* 1-B Top 10 랭킹 표 */}
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            1-B Top {TOP_N} 랭킹 · {platformLabel} <LangBadge lang="ja" />
          </h3>
          {selected.length > 0 ? (
            <Link href={`/market/competitors?compare=${selected.join(",")}`} className={buttonVariants({ size: "sm" })}>
              선택 제품 비교 ({selected.length}) →
            </Link>
          ) : (
            <span className={`${buttonVariants({ size: "sm", variant: "outline" })} pointer-events-none opacity-50`}>선택 제품 비교 (0)</span>
          )}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={STICKY.check}>
                <span className="sr-only">비교 선택</span>
              </TableHead>
              <TableHead className={STICKY.rank}>순위</TableHead>
              <TableHead className={STICKY.name}>상품명 (원문 · 해석)</TableHead>
              <TableHead className={STICKY.ppm} title={DEFINITIONS.ppm}>
                ml당 가격
              </TableHead>
              {hasPrev && <TableHead>변동</TableHead>}
              <TableHead>브랜드</TableHead>
              <TableHead>K-뷰티</TableHead>
              <TableHead className="text-right">판매가(税込)</TableHead>
              <TableHead className="text-right">용량</TableHead>
              <TableHead className={WIDE_ONLY}>핵심 성분</TableHead>
              <TableHead className={WIDE_ONLY}>소구 태그·배지</TableHead>
              <TableHead className={WIDE_ONLY}>프로모션</TableHead>
              <TableHead className="text-right">평점·리뷰</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{top.map(rankRow)}</TableBody>
        </Table>
        <p className="mt-1 text-xs text-muted-foreground">
          행을 누르면 오른쪽에 제품 요약이 열려요 · 체크하거나 패널의 [비교에 추가]로 최대 {MAX_COMPARE}개까지 골라 비교 · 등록된 제품만 비교할 수 있어요 · 판매가는 평시가
          {sale ? ` · 이 주는 ${sale.title} 기간이라 순위가 행사 영향을 받았을 수 있어요` : ""}
        </p>
        {nearTop.length > 0 && (
          <details className="mt-3 rounded-md border">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
              {TOP_N + 1}~{nearTop.at(-1)?.rank}위 진입 직전 ({nearTop.length}개)
            </summary>
            <Table>
              <TableBody>{nearTop.map(rankRow)}</TableBody>
            </Table>
          </details>
        )}
      </div>

      {/* 1-C 상위권 공통 특징 */}
      <div>
        <h3 className="mb-2 text-sm font-semibold">1-C 상위권 공통 특징</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>소구 태그 비중 · Top {TOP_N}</CardTitle>
            </CardHeader>
            <CardContent>
              {tags.length === 0 ? (
                <p className="text-sm text-muted-foreground">사전에 있는 소구 태그가 없어요</p>
              ) : (
                <HorizontalBarChart
                  items={tags.map((t) => ({ id: t.tag, label: `${t.tag} ${t.ko}`, value: t.rows.length }))}
                  unit={`/${TOP_N}`}
                  labelWidth={150}
                  onSelect={(id) => {
                    const t = tags.find((x) => x.tag === id);
                    if (t) list(`소구 태그 · ${t.tag} (${t.ko})`, DEFINITIONS.tags, t.rows.map((row) => ({ row, note: `원문 표기: ${row.matched}` })));
                  }}
                />
              )}
              <p className="mt-1 text-xs text-muted-foreground">{DEFINITIONS.tags} · 막대를 누르면 해당 제품</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>성분 관심도 · 20위 안 언급</CardTitle>
            </CardHeader>
            <CardContent>
              {mentions.length === 0 ? (
                <p className="text-sm text-muted-foreground">사전에 있는 성분이 나온 제품이 없어요</p>
              ) : (
                <>
                  <HorizontalBarChart
                    items={mentions.map((m) => ({
                      id: m.ingredient,
                      label: `${m.ko}${own.has(m.ingredient) ? " · 자사 포함" : ""}`,
                      value: m.rows.length,
                      highlight: own.has(m.ingredient),
                      selected: m.ingredient === activeIngredient,
                    }))}
                    unit="개"
                    labelWidth={150}
                    onSelect={(id) => {
                      setIngredient(id);
                      const m = mentions.find((x) => x.ingredient === id);
                      if (m) list(`성분 · ${m.ko}`, DEFINITIONS.ingredients, m.rows.map((row) => ({ row, note: `원문 표기: ${row.matched}` })));
                    }}
                  />
                  {activeIngredient && (
                    <>
                      <p className="mt-3 text-xs font-medium text-muted-foreground">
                        {INGREDIENT_MATCH[activeIngredient]?.ko ?? activeIngredient} 언급 제품 수 · {series.length}주
                      </p>
                      <TrendLineChart
                        data={ingredientTrend(series, activeIngredient).map((p) => ({ week: p.week, count: p.count }))}
                        series={[{ key: "count", label: "언급 제품 수", color: "var(--primary)", emphasis: true }]}
                        unit="개"
                        height={140}
                      />
                    </>
                  )}
                </>
              )}
              <p className="mt-1 text-xs text-muted-foreground">{DEFINITIONS.ingredients} · 진한 막대·「자사 포함」 = 자사 제품 전성분에 있는 성분 · 막대를 누르면 해당 제품과 추이</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
