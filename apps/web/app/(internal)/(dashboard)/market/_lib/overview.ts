// 시장 분석 원페이지(/market)의 계산. 모든 숫자는 근거 제품 목록과 함께 돌려줘서 화면에서 눌러 확인할 수 있게 한다.
import type { Product } from "@/lib/schemas/product";
import type { PromoEvent } from "@/lib/schemas/promo";
import type { PromoHookType, RankingItem, TrendSnapshot } from "@/lib/schemas/trend";
import { APPEAL_TAGS, type MarketPlatform } from "@/lib/market-config";
import { fold } from "@/lib/ai/appeal-normalize";
import { INGREDIENT_MATCH, productKey, TOP_N, weekLabel } from "./market";

/** 화면 한 줄: 랭킹 항목 + 전주 순위 + 계산 값 */
export type OverviewRow = RankingItem & {
  prevRank: number | null;
  /** ml당 실질 단가 (판매가 ÷ 총 용량) */
  ppm: number | null;
  /** 사전에 있는 성분만 (상품명·설명에서 찾음) */
  ingredients: { ingredient: string; matched: string }[];
  /** 사전에 있는 소구 태그만 */
  tags: { tag: string; matched: string }[];
};

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function itemText(r: Pick<RankingItem, "name" | "description_ja">): string {
  return `${r.name}\n${r.description_ja ?? ""}`;
}

/** 원문에 있는 사전 표기를 돌려준다 (전각·반각·대소문자 차이 무시, 없으면 null) */
function findAlias(text: string, aliases: string[]): string | null {
  const folded = fold(text);
  return aliases.find((a) => folded.includes(fold(a))) ?? null;
}

/** ml당 실질 단가: 판매가 ÷ (용량 + 같은 제품의 추가 용량). 다른 제품 증정품은 더하지 않는다 */
export function effectivePricePerMl(r: Pick<RankingItem, "price_jpy" | "volume_ml" | "extra_volume_ml">): number | null {
  if (!r.volume_ml) return null;
  return round1(r.price_jpy / (r.volume_ml + (r.extra_volume_ml ?? 0)));
}

function toRow(r: RankingItem, prev: TrendSnapshot | undefined): OverviewRow {
  const text = itemText(r);
  return {
    ...r,
    prevRank: prev?.data.ranking.find((x) => productKey(x.brand, x.name) === productKey(r.brand, r.name))?.rank ?? null,
    ppm: effectivePricePerMl(r),
    ingredients: Object.entries(INGREDIENT_MATCH).flatMap(([ingredient, { match }]) => {
      const matched = findAlias(text, match);
      return matched ? [{ ingredient, matched }] : [];
    }),
    tags: Object.entries(APPEAL_TAGS).flatMap(([tag, { aliases }]) => {
      const matched = findAlias(text, aliases);
      return matched ? [{ tag, matched }] : [];
    }),
  };
}

/** 플랫폼·카테고리의 스냅샷 (오래된 순) */
export function seriesOf(snapshots: TrendSnapshot[], source: MarketPlatform, category: string): TrendSnapshot[] {
  return snapshots.filter((s) => s.source === source && s.category === category).toSorted((a, b) => a.captured_at.localeCompare(b.captured_at));
}

/** i번째 주의 랭킹 (20위까지) */
export function rowsAt(series: TrendSnapshot[], i: number): OverviewRow[] {
  const s = series[i];
  return s ? s.data.ranking.map((r) => toRow(r, series[i - 1])) : [];
}

export function top10(rows: OverviewRow[]): OverviewRow[] {
  return rows.filter((r) => r.rank <= TOP_N);
}

// ── PART 1-A. 상위권 진입 조건 ─────────────────────

/** 선형 보간 사분위 (q = 0.25, 0.5, 0.75) */
function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export type EntryKind = "rose" | "brand_new_product" | "new_brand";
export const ENTRY_KIND_LABEL: Record<EntryKind, string> = {
  rose: "20위 안에서 올라옴",
  brand_new_product: "기존 브랜드의 신상품",
  new_brand: "새 브랜드",
};

export type EntryConditions = {
  ppm: { q1: number; median: number; q3: number; priceMin: number; priceMedian: number; priceMax: number; rows: OverviewRow[] } | null;
  promo: { type: PromoHookType; count: number; rows: OverviewRow[] } | null;
  /** 전주 Top 10에 없던 제품. 전주 데이터가 없으면 null */
  entries: { count: number; byKind: Record<EntryKind, number>; rows: (OverviewRow & { entryKind: EntryKind })[] } | null;
};

export function entryConditions(series: TrendSnapshot[], allSameSource: TrendSnapshot[]): EntryConditions | null {
  const i = series.length - 1;
  const top = top10(rowsAt(series, i));
  if (top.length === 0) return null;

  const withPpm = top.filter((r) => r.ppm !== null);
  const ppms = withPpm.map((r) => r.ppm as number).toSorted((a, b) => a - b);
  const prices = top.map((r) => r.price_jpy).toSorted((a, b) => a - b);

  const promoCounts = new Map<PromoHookType, OverviewRow[]>();
  for (const r of top) if (r.promo_type) promoCounts.set(r.promo_type, [...(promoCounts.get(r.promo_type) ?? []), r]);
  const topPromo = [...promoCounts.entries()].toSorted((a, b) => b[1].length - a[1].length)[0];


  const prev = series[i - 1];
  let entries: EntryConditions["entries"] = null;
  if (prev) {
    const prevTop = new Set(prev.data.ranking.filter((r) => r.rank <= TOP_N).map((r) => productKey(r.brand, r.name)));
    const earlier = allSameSource.filter((s) => s.captured_at < series[i].captured_at);
    const seenProducts = new Set(earlier.filter((s) => s.category === series[i].category).flatMap((s) => s.data.ranking.map((r) => productKey(r.brand, r.name))));
    const seenBrands = new Set(earlier.flatMap((s) => s.data.ranking.map((r) => r.brand)));
    const rows = top
      .filter((r) => !prevTop.has(productKey(r.brand, r.name)))
      .map((r) => ({
        ...r,
        entryKind: (seenProducts.has(productKey(r.brand, r.name)) ? "rose" : seenBrands.has(r.brand) ? "brand_new_product" : "new_brand") as EntryKind,
      }));
    entries = {
      count: rows.length,
      byKind: { rose: rows.filter((r) => r.entryKind === "rose").length, brand_new_product: rows.filter((r) => r.entryKind === "brand_new_product").length, new_brand: rows.filter((r) => r.entryKind === "new_brand").length },
      rows,
    };
  }

  return {
    ppm:
      ppms.length === 0
        ? null
        : { q1: round1(quantile(ppms, 0.25)), median: round1(quantile(ppms, 0.5)), q3: round1(quantile(ppms, 0.75)), priceMin: prices[0], priceMedian: Math.round(quantile(prices, 0.5)), priceMax: prices.at(-1) as number, rows: withPpm.toSorted((a, b) => (a.ppm as number) - (b.ppm as number)) },
    promo: topPromo ? { type: topPromo[0], count: topPromo[1].length, rows: topPromo[1] } : null,
    entries,
  };
}

/** 랭킹이 집계된 주(수집일 앞 7일)가 플랫폼 행사와 겹치면 그 행사 (가격은 평시가지만 순위가 행사 영향을 받는다) */
export function saleEventFor(capturedAt: string, platformName: string, events: PromoEvent[]): PromoEvent | null {
  const end = capturedAt.slice(0, 10);
  const startTime = Date.UTC(+end.slice(0, 4), +end.slice(5, 7) - 1, +end.slice(8, 10)) - 6 * 86_400_000;
  const start = new Date(startTime).toISOString().slice(0, 10);
  return events.find((e) => e.kind !== "own_campaign" && e.platform === platformName && e.start_date <= end && e.end_date >= start) ?? null;
}

// ── PART 1-C. 상위권 공통 특징 ─────────────────────

export type TagShare = { tag: string; ko: string; rows: (OverviewRow & { matched: string })[] };

/** Top 10 중 각 소구 태그를 가진 제품 (많은 순, 0개는 뺀다) */
export function tagShare(top: OverviewRow[]): TagShare[] {
  return Object.entries(APPEAL_TAGS)
    .map(([tag, { ko }]) => ({ tag, ko, rows: top.flatMap((r) => r.tags.filter((t) => t.tag === tag).map((t) => ({ ...r, matched: t.matched }))) }))
    .filter((t) => t.rows.length > 0)
    .toSorted((a, b) => b.rows.length - a.rows.length);
}

export type IngredientMention = { ingredient: string; ko: string; rows: (OverviewRow & { matched: string })[] };

/** 이번 주 랭킹(20위까지) 상품명·설명에 성분이 나온 제품 (많은 순, 0개는 뺀다) */
export function ingredientMentions(rows: OverviewRow[]): IngredientMention[] {
  return Object.entries(INGREDIENT_MATCH)
    .map(([ingredient, { ko }]) => ({ ingredient, ko, rows: rows.flatMap((r) => r.ingredients.filter((x) => x.ingredient === ingredient).map((x) => ({ ...r, matched: x.matched }))) }))
    .filter((m) => m.rows.length > 0)
    .toSorted((a, b) => b.rows.length - a.rows.length);
}

/** 성분 하나의 주별 언급 제품 수 (20위까지) */
export function ingredientTrend(series: TrendSnapshot[], ingredient: string): { week: string; count: number }[] {
  return series.map((_, i) => ({ week: weekLabel(series[i].captured_at), count: rowsAt(series, i).filter((r) => r.ingredients.some((x) => x.ingredient === ingredient)).length }));
}

// ── 제품 요약 패널 ────────────────────────────────

/** 자사 비교 기준 제품: 같은 카테고리의 자사 제품 중 첫 번째 (판매 중 제품이 앞에 있다) */
export function ownBaseline(products: Product[], category: string): Product | null {
  return products.find((p) => p.kind === "own" && p.category === category) ?? null;
}

export function ownDiff(row: OverviewRow, own: Product) {
  const ownPpm = own.price_jpy != null && own.volume_ml ? round1(own.price_jpy / own.volume_ml) : null;
  const ownText = own.ingredients.join("、");
  const ownHas = new Set(Object.entries(INGREDIENT_MATCH).flatMap(([ing, { match }]) => (findAlias(ownText, match) ? [ing] : [])));
  const rowHas = new Set(row.ingredients.map((x) => x.ingredient));
  return {
    ownPpm,
    ppmDiff: ownPpm !== null && row.ppm !== null ? round1(row.ppm - ownPpm) : null,
    /** 이 제품에는 있고 자사에는 없는 핵심 성분 */
    missingInOwn: [...rowHas].filter((x) => !ownHas.has(x)),
    /** 자사에만 있는 핵심 성분 */
    onlyOwn: [...ownHas].filter((x) => !rowHas.has(x)),
  };
}

// ── PART 0. 가격 포지셔닝 맵 ──────────────────────
// [심리적 가격 저항선 × 실질 가치]: 장바구니에서 느끼는 판매가와 실제 용량 대비 ml당 실질 가격의 괴리를 본다.
// 정가 기준이 기본이고, 할인 적용가 기준으로 바꿔 보면 순위권 제품을 실제로 얼마에 사는지 보인다 (Qoo10은 대부분 할인 중)

export type PriceMode = "list" | "sale";

export type PricePoint = {
  id: string;
  label: string;
  /** 지금 보기 기준의 판매가 (정가 또는 할인 적용가) */
  price: number;
  /** 지금 보기 기준의 ml당 실질 가격 */
  ppm: number;
  listPrice: number;
  salePrice: number | null;
  discountRate: number | null;
  /** 프로모션 문구 (수상 배지는 프로모션이 아님). 없으면 null */
  promo: string | null;
  /** 할인 또는 프로모션 진행 중 */
  onPromo: boolean;
  own: boolean;
  row?: OverviewRow;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  return round1(quantile(values.toSorted((a, b) => a - b), 0.5));
}

export function priceMap(top: OverviewRow[], products: Product[], category: string, mode: PriceMode) {
  const points: PricePoint[] = top.flatMap((r) => {
    if (r.ppm === null || !r.volume_ml) return [];
    const volume = r.volume_ml + (r.extra_volume_ml ?? 0);
    const salePrice = r.sale_price_jpy ?? null;
    const price = mode === "sale" && salePrice !== null ? salePrice : r.price_jpy;
    const promo = r.promo_type && r.promo_type !== "award" ? (r.promo_text ?? null) : null;
    return [
      {
        id: `${r.brand}|${r.name}`,
        label: `${r.rank}위 ${r.brand} ${r.name}`,
        price,
        ppm: round1(price / volume),
        listPrice: r.price_jpy,
        salePrice,
        discountRate: r.discount_rate ?? null,
        promo,
        onPromo: (r.discount_rate ?? 0) > 0 || promo !== null,
        own: false,
        row: r,
      },
    ];
  });
  // 자사는 가격이 정해져 있어 정가 그대로 찍는다 (할인 전략을 정할 때 비교 기준)
  const own: PricePoint[] = products
    .filter((p) => p.kind === "own" && p.category === category && p.price_jpy != null && p.volume_ml)
    .map((p) => ({ id: p.id, label: `자사 ${p.name}`, price: p.price_jpy as number, ppm: round1((p.price_jpy as number) / (p.volume_ml as number)), listPrice: p.price_jpy as number, salePrice: null, discountRate: null, promo: null, onPromo: false, own: true }));
  const rates = points.map((p) => p.discountRate).filter((v): v is number => v !== null && v > 0);
  const all = [...points, ...own];
  const pad = (lo: number, hi: number): [number, number] => {
    const gap = Math.max((hi - lo) * 0.12, hi * 0.05);
    return [Math.max(0, Math.floor(lo - gap)), Math.ceil(hi + gap)];
  };
  return {
    points,
    own,
    medianPrice: median(points.map((p) => p.price)),
    medianPpm: median(points.map((p) => p.ppm)),
    /** 할인 데이터가 하나라도 있는지 (없으면 할인 적용가 보기를 막는다) */
    hasDiscount: rates.length > 0,
    discountedCount: rates.length,
    medianRate: median(rates),
    /** 자사 제품마다 지금 보기 기준으로 ml당이 더 싼 순위권 제품 수 */
    ownCheaperThan: own.map((o) => ({ id: o.id, name: o.label, ppm: o.ppm, cheaper: points.filter((p) => p.ppm < o.ppm).length })),
    /** 점이 화면을 꽉 채우도록 축 범위를 데이터에 맞춘다 */
    domainX: all.length > 0 ? pad(Math.min(...all.map((p) => p.price)), Math.max(...all.map((p) => p.price))) : null,
    domainY: all.length > 0 ? pad(Math.min(...all.map((p) => p.ppm)), Math.max(...all.map((p) => p.ppm))) : null,
    /** 용량 정보가 없어 찍지 못한 제품 */
    unplaced: top.filter((r) => r.ppm === null || !r.volume_ml),
  };
}
