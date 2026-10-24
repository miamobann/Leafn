// 검색 자동완성 시드와 검색어 분류 (AI 없이 사전으로만 분류한다. 사전에 없는 말은 해석하지 않고 그대로 "새 검색어"로 둔다)
import { fold, matchIngredient } from "@/lib/ai/appeal-normalize";
import type { SkinConcern } from "@/lib/schemas/trend";

/** 끝의 공백까지가 시드다 (그 뒤에 붙는 말을 자동완성으로 받는다) */
// クリーム는 시장 분석 원페이지에서 카테고리를 바꿔도 자동완성이 나오도록 추가 (2026-10-24)
export const AUTOCOMPLETE_SEEDS = ["化粧水 ", "化粧水 成分 ", "美容液 ", "韓国 化粧水 ", "クリーム "];
export const AUTOCOMPLETE_REGION = { gl: "jp", hl: "ja" } as const;

/** 성분 검색 관심도(Google Trends): 카테고리마다 「카테고리 + 성분」 검색어를 비교한다 · 일본, 최근 3개월 평균 */
export const TRENDS_CATEGORIES = ["化粧水", "美容液", "クリーム", "日焼け止め"] as const;
export const TRENDS_REGION = { geo: "JP", hl: "ja", date: "today 3-m" } as const;
/** 소비자가 실제로 치는 표기 (シカ, ビタミンC처럼). 화면에서는 성분 사전 이름으로 보여 준다 */
export const TRENDS_INGREDIENT_TERMS = [
  "ヒアルロン酸", "セラミド", "ナイアシンアミド", "レチノール", "ビタミンC", "シカ",
  "ドクダミ", "パンテノール", "トラネキサム酸", "スクワラン", "PDRN", "アゼライン酸",
];

/**
 * 5개씩 나눈 Google Trends 결과를 한 저울로 맞춘다.
 * 첫 묶음에서 가장 높은 말을 기준어로 삼아 다음 묶음마다 같이 넣고, 기준어 값의 비율로 환산한 뒤 1위 = 100으로 다시 맞춘다
 */
export async function collectOnOneScale(
  queries: string[],
  fetchBatch: (batch: string[]) => Promise<Record<string, number>>,
  batchSize = 5,
): Promise<{ query: string; interest: number }[]> {
  const first = queries.slice(0, batchSize);
  const base = await fetchBatch(first);
  const values = new Map(first.map((q) => [q, base[q] ?? 0]));
  const anchor = first.reduce((best, q) => ((base[q] ?? 0) > (base[best] ?? 0) ? q : best), first[0]);
  const anchorBase = base[anchor] ?? 0;
  for (let i = batchSize; i < queries.length; i += batchSize - 1) {
    const chunk = queries.slice(i, i + batchSize - 1);
    const r = await fetchBatch([anchor, ...chunk]);
    // 기준어가 0이면 비율을 낼 수 없어 그 묶음은 0으로 둔다 (검색량이 아주 적은 카테고리)
    const factor = anchorBase > 0 && (r[anchor] ?? 0) > 0 ? anchorBase / r[anchor] : 0;
    for (const q of chunk) values.set(q, (r[q] ?? 0) * factor);
  }
  const max = Math.max(0, ...values.values());
  return [...values]
    .map(([query, v]) => ({ query, interest: max > 0 ? Math.round((v / max) * 100) : 0 }))
    .toSorted((a, b) => b.interest - a.interest);
}

const CONCERN_WORDS: [SkinConcern, string[]][] = [
  ["pores", ["毛穴"]],
  ["acne", ["ニキビ", "肌荒れ", "肌あれ"]],
  ["dryness", ["乾燥", "保湿", "インナードライ"]],
  ["sensitivity", ["敏感肌", "ゆらぎ"]],
  ["dullness", ["美白", "くすみ", "透明感", "シミ"]],
  ["aging", ["シワ", "ハリ", "エイジング", "たるみ"]],
  ["redness", ["赤み"]],
  ["oiliness", ["脂性肌", "テカリ", "皮脂", "オイリー"]],
];

/** 성분·고민이 아닌 일반어 (추천, 드럭스토어, 인기 등) */
const GENERIC_WORDS = [
  "化粧水", "美容液", "成分", "韓国", "おすすめ", "ランキング", "人気", "ドラッグストア", "市販", "プチプラ", "安い", "口コミ",
  "メンズ", "使い方", "順番", "付け方", "量", "デパコス", "とは", "効果", "コスパ", "最強", "大容量", "高校生", "20代", "30代", "40代", "50代",
];

function matchConcern(token: string): SkinConcern | null {
  const folded = fold(token);
  return CONCERN_WORDS.find(([, words]) => words.some((w) => folded.includes(fold(w))))?.[0] ?? null;
}

function isGeneric(token: string): boolean {
  const folded = fold(token);
  return GENERIC_WORDS.some((w) => folded === fold(w));
}

export type SuggestionTerms = { ingredients: string[]; concerns: SkinConcern[]; unknown: string[] };

/** "化粧水 レチノール 市販" → 성분 [レチノール], 일반어(市販)는 버림 */
export function classifySuggestion(value: string): SuggestionTerms {
  const terms: SuggestionTerms = { ingredients: [], concerns: [], unknown: [] };
  for (const token of value.split(/[\s　]+/).filter(Boolean)) {
    if (isGeneric(token)) continue;
    const ing = matchIngredient(token);
    if (ing) {
      terms.ingredients.push(ing);
      continue;
    }
    const concern = matchConcern(token);
    if (concern) terms.concerns.push(concern);
    else terms.unknown.push(token);
  }
  return terms;
}
