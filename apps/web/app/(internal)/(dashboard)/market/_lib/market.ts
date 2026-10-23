// 시장 분석(TAB 1) 화면이 같이 쓰는 계산. 데이터는 lib/data에서 받아 여기서 가공만 한다.
import type { Product } from "@/lib/schemas/product";
import type { TrendSnapshot } from "@/lib/schemas/trend";

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
