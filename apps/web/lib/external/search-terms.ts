// 검색 자동완성 시드와 검색어 분류 (AI 없이 사전으로만 분류한다. 사전에 없는 말은 해석하지 않고 그대로 "새 검색어"로 둔다)
import { fold, matchIngredient } from "@/lib/ai/appeal-normalize";
import type { SkinConcern } from "@/lib/schemas/trend";

/** 끝의 공백까지가 시드다 (그 뒤에 붙는 말을 자동완성으로 받는다) */
export const AUTOCOMPLETE_SEEDS = ["化粧水 ", "化粧水 成分 ", "美容液 ", "韓国 化粧水 "];
export const AUTOCOMPLETE_REGION = { gl: "jp", hl: "ja" } as const;

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
