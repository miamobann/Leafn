// 시장 분석(TAB 1) 화면이 같이 쓰는 계산. 데이터는 lib/data에서 받아 여기서 가공만 한다.
import type { Product } from "@/lib/schemas/product";
import type { SearchSnap } from "@/lib/schemas/search";
import type { PromoHookType, RankingItem, SkinConcern, TrendSnapshot } from "@/lib/schemas/trend";
import { classifySuggestion } from "@/lib/external/search-terms";
import { matchIngredient } from "@/lib/ai/appeal-normalize";

export const OWN_BRAND = "Leafn";
export const MARKET_CATEGORIES = ["化粧水", "美容液", "クリーム"] as const;
export const TOP_N = 10;

/** 자사 제품과 겹치는 성분을 볼 때 빼는 흔한 기제·보존제 */
export const COMMON_INGREDIENTS = new Set(["水", "BG", "グリセリン", "フェノキシエタノール"]);

/** 성분 관심도의 성분 이름 → 全成分 표기에서 찾을 문자열 (ヒアルロン酸 → ヒアルロン酸Na 등) */
export const INGREDIENT_MATCH: Record<string, { ko: string; match: string[] }> = {
  "ヒアルロン酸": { ko: "히알루론산", match: ["ヒアルロン酸"] },
  "セラミド": { ko: "세라마이드", match: ["セラミド"] },
  "ナイアシンアミド": { ko: "나이아신아마이드", match: ["ナイアシンアミド"] },
  "ツボクサエキス": { ko: "병풀(시카)", match: ["ツボクサ"] },
  "レチノール": { ko: "레티놀", match: ["レチノール"] },
  "ビタミンC誘導体": { ko: "비타민C 유도체", match: ["アスコルビ"] },
  "ドクダミエキス": { ko: "어성초", match: ["ドクダミ"] },
  "パンテノール": { ko: "판테놀", match: ["パンテノール"] },
  "トラネキサム酸": { ko: "트라넥삼산", match: ["トラネキサム酸"] },
  "スクワラン": { ko: "스쿠알란", match: ["スクワラン"] },
};

export function hasIngredient(p: Pick<Product, "ingredients">, ingredient: string): boolean {
  const terms = INGREDIENT_MATCH[ingredient]?.match ?? [ingredient];
  return p.ingredients.some((x) => terms.some((t) => x.includes(t)));
}

/** 자사 제품에 들어 있는 성분 관심도 성분 */
export function ownIngredients(products: Product[]): Set<string> {
  const own = products.filter((p) => p.kind === "own");
  return new Set(Object.keys(INGREDIENT_MATCH).filter((ing) => own.some((p) => hasIngredient(p, ing))));
}

/** "2026-08-03T06:00:00+09:00" → "8/3" */
export function weekLabel(capturedAt: string): string {
  return `${+capturedAt.slice(5, 7)}/${+capturedAt.slice(8, 10)}`;
}

/** 상위 TOP_N 중 K-뷰티 비중 (%) */
export function kbeautyShare(s: TrendSnapshot): number {
  const top = s.data.ranking.filter((r) => r.rank <= TOP_N);
  return top.length === 0 ? 0 : Math.round((top.filter((r) => r.is_kbeauty).length / top.length) * 100);
}

export function productKey(brand: string, name: string): string {
  return `${brand}|${name}`;
}

export type RankRow = TrendSnapshot["data"]["ranking"][number] & { prevRank: number | null; productId: string | null };

/** 카테고리의 최신 스냅샷 순위 + 전주 순위 + 등록 제품 연결 */
export function latestRanking(snapshots: TrendSnapshot[], category: string, products: Product[]): RankRow[] {
  const list = snapshots.filter((s) => s.category === category);
  const latest = list.at(-1);
  const prev = list.at(-2);
  if (!latest) return [];
  const ids = new Map(products.map((p) => [productKey(p.brand, p.name), p.id]));
  return latest.data.ranking.map((r) => ({
    ...r,
    prevRank: prev?.data.ranking.find((x) => x.brand === r.brand && x.name === r.name)?.rank ?? null,
    productId: ids.get(productKey(r.brand, r.name)) ?? null,
  }));
}

/** 제품의 주별 순위 (楽天 랭킹에 없으면 null) */
export function rankHistory(snapshots: TrendSnapshot[], p: Pick<Product, "brand" | "name">) {
  const points = snapshots
    .map((s) => ({ week: weekLabel(s.captured_at), category: s.category, rank: s.data.ranking.find((r) => r.brand === p.brand && r.name === p.name)?.rank ?? null }))
    .filter((x): x is { week: string; category: string; rank: number } => x.rank !== null);
  return points.length === 0 ? null : { category: points[0].category, points };
}

export const PROMO_HOOK_LABEL: Record<PromoHookType, string> = {
  bundle: "세트·1+1",
  discount: "할인",
  limited: "기간·행사 한정",
  gift: "증정",
  award: "수상·랭킹",
  other: "기타",
};

export const SKIN_CONCERN_LABEL: Record<SkinConcern, string> = {
  pores: "모공",
  acne: "트러블",
  dryness: "건조",
  sensitivity: "민감",
  dullness: "칙칙함",
  aging: "탄력",
  redness: "붉은기",
  oiliness: "피지",
  other: "기타",
};

export type HeroIngredientStat = {
  ingredient: string;
  count: number;
  avgPrice: number;
  avgRank: number;
  hooks: { type: PromoHookType; count: number }[];
  concerns: { code: SkinConcern; count: number }[];
  items: RankingItem[];
};

function tally<K extends string>(keys: K[]): { key: K; count: number }[] {
  const m = new Map<K, number>();
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m].map(([key, count]) => ({ key, count })).toSorted((a, b) => b.count - a.count);
}

/** 상위 TOP_N 상품이 이미지에서 내세운 성분별 집계 (제품 수 많은 순, 같으면 평균 순위 높은 순) */
export function heroIngredientStats(s: Pick<TrendSnapshot, "data"> | undefined): HeroIngredientStat[] {
  const top = (s?.data.ranking ?? []).filter((r) => r.rank <= TOP_N && r.appeal);
  const byIngredient = new Map<string, RankingItem[]>();
  for (const r of top) {
    for (const ing of new Set(r.appeal?.hero_ingredients.map((h) => h.canonical))) {
      byIngredient.set(ing, [...(byIngredient.get(ing) ?? []), r]);
    }
  }
  return [...byIngredient]
    .map(([ingredient, items]) => ({
      ingredient,
      count: items.length,
      avgPrice: Math.round(items.reduce((sum, r) => sum + r.price_jpy, 0) / items.length),
      avgRank: Math.round((items.reduce((sum, r) => sum + r.rank, 0) / items.length) * 10) / 10,
      hooks: tally(items.flatMap((r) => [...new Set(r.appeal?.promo_hooks.map((h) => h.type))])).map(({ key, count }) => ({ type: key, count })),
      concerns: tally(items.flatMap((r) => [...new Set(r.appeal?.skin_concerns.map((c) => c.code))])).map(({ key, count }) => ({ code: key, count })),
      items,
    }))
    .toSorted((a, b) => b.count - a.count || a.avgRank - b.avgRank);
}

export type HeroCompareRow = { ingredient: string; rakuten: HeroIngredientStat | null; qoo10: HeroIngredientStat | null };

/** 출처별 집계를 성분 이름으로 나란히 놓는다. 제품끼리 합치지 않으므로 같은 제품이 두 곳에 있어도 각자 센다 */
export function compareHeroStats(rakuten: HeroIngredientStat[], qoo10: HeroIngredientStat[]): HeroCompareRow[] {
  const names = [...new Set([...rakuten, ...qoo10].map((h) => h.ingredient))];
  return names
    .map((ingredient) => ({
      ingredient,
      rakuten: rakuten.find((h) => h.ingredient === ingredient) ?? null,
      qoo10: qoo10.find((h) => h.ingredient === ingredient) ?? null,
    }))
    .toSorted((a, b) => (b.rakuten?.count ?? 0) + (b.qoo10?.count ?? 0) - ((a.rakuten?.count ?? 0) + (a.qoo10?.count ?? 0)));
}

export type SearchTermKind = "concern" | "new";
export type SearchTermStatus = "new" | "up" | "flat" | "down";
export type SearchTermStat = {
  key: string;
  kind: SearchTermKind;
  label: string;
  latest: number;
  /** 비교 기준 (COMPARE_WEEKS 주 전, 기록이 짧으면 첫 주) */
  base: number;
  delta: number;
  status: SearchTermStatus;
};

const COMPARE_WEEKS = 4;
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * 자동완성(google_autocomplete)에서 피부 고민·사전에 없는 새 검색어의 추세.
 * 점수 = 시드마다 그 말이 나온 순위의 가중치 합 (1위 1.0 … 10위 0.1). 성분 순위는 Google Trends(ingredientInterestRanking)로 본다
 */
export function searchTrendStats(all: SearchSnap[]) {
  const snaps = all.filter((s) => s.engine === "google_autocomplete");
  const dates = [...new Set(snaps.map((s) => s.captured_at.slice(0, 10)))].toSorted();
  const scores = new Map<string, { kind: SearchTermKind; label: string; byDate: Map<string, number> }>();
  const add = (key: string, kind: SearchTermKind, label: string, date: string, w: number) => {
    const entry = scores.get(key) ?? { kind, label, byDate: new Map<string, number>() };
    entry.byDate.set(date, (entry.byDate.get(date) ?? 0) + w);
    scores.set(key, entry);
  };
  for (const snap of snaps) {
    const date = snap.captured_at.slice(0, 10);
    for (const sug of snap.suggestions) {
      const w = (11 - Math.min(sug.position, 10)) / 10;
      const terms = classifySuggestion(sug.value);
      for (const c of new Set(terms.concerns)) add(`concern:${c}`, "concern", SKIN_CONCERN_LABEL[c], date, w);
      for (const u of new Set(terms.unknown)) add(`new:${u}`, "new", u, date, w);
    }
  }
  const baseDate = dates[Math.max(0, dates.length - 1 - COMPARE_WEEKS)];
  const latestDate = dates.at(-1);
  const stats: SearchTermStat[] = [...scores].map(([key, e]) => {
    const latest = round1(latestDate ? (e.byDate.get(latestDate) ?? 0) : 0);
    const base = round1(baseDate ? (e.byDate.get(baseDate) ?? 0) : 0);
    const delta = round1(latest - base);
    const status: SearchTermStatus = base === 0 && latest > 0 ? "new" : delta >= 0.5 ? "up" : delta <= -0.5 ? "down" : "flat";
    return { key, kind: e.kind, label: e.label, latest, base, delta, status };
  });
  const byMomentum = (a: SearchTermStat, b: SearchTermStat) => b.delta - a.delta || b.latest - a.latest;
  return {
    weeks: dates.length,
    compareWeeks: Math.min(COMPARE_WEEKS, Math.max(0, dates.length - 1)),
    lastCaptured: snaps.map((s) => s.captured_at).toSorted().at(-1) ?? null,
    concerns: stats.filter((s) => s.kind === "concern" && s.latest > 0).toSorted(byMomentum),
    newTerms: stats.filter((s) => s.kind === "new" && s.latest > 0 && s.status === "new").toSorted(byMomentum),
  };
}

export type InterestRow = {
  rank: number;
  /** 검색어에서 카테고리를 뺀 성분 표기 (例: シカ) */
  term: string;
  /** 성분 사전 이름 (例: ツボクサエキス). 사전에 없으면 null */
  canonical: string | null;
  /** 검색 관심도 0~100 (1위 = 100) */
  interest: number;
  /** 직전 수집의 순위 (처음이면 null) */
  prevRank: number | null;
};

/** 카테고리의 최신 Google Trends 성분 순위 + 직전 수집 대비 순위 변화 */
export function ingredientInterestRanking(all: SearchSnap[], category: string) {
  const list = all.filter((s) => s.engine === "google_trends" && s.seed === category).toSorted((a, b) => a.captured_at.localeCompare(b.captured_at));
  const latest = list.at(-1);
  const prev = list.at(-2);
  const termOf = (value: string) => value.replace(new RegExp(`^${category}\\s*`), "").trim();
  const rows: InterestRow[] = (latest?.suggestions ?? []).map((s) => {
    const term = termOf(s.value);
    return {
      rank: s.position,
      term,
      canonical: matchIngredient(term),
      interest: s.relevance ?? 0,
      prevRank: prev?.suggestions.find((p) => termOf(p.value) === term)?.position ?? null,
    };
  });
  return { rows, capturedAt: latest?.captured_at ?? null, hasPrev: Boolean(prev) };
}
