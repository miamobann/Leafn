// 이미지 분석 결과의 후처리 (AI 호출 없음, 순수 함수).
// 1) 근거 문구가 이미지 글자(ocr_text)나 크롤링 텍스트에 그대로 있는지 대조해 없으면 버린다
// 2) 성분 이름을 사전으로 통일한다 (AI가 정하지 않는다)
// 3) 기제·보존제는 소구 성분에서 뺀다
import type { AppealAiOutput, AppealAnalysis } from "@/lib/schemas/trend";

/** 통일 이름 → 이미지·상품명에 나오는 표기. 키는 성분 관심도(market/_lib INGREDIENT_MATCH)와 같은 이름을 쓴다 */
const INGREDIENT_ALIASES: Record<string, string[]> = {
  "ドクダミエキス": ["ドクダミ"],
  "ツボクサエキス": ["ツボクサ", "CICA", "シカ"],
  "ナイアシンアミド": ["ナイアシンアミド"],
  "ヒアルロン酸": ["ヒアルロン"],
  "セラミド": ["セラミド"],
  "ビタミンC誘導体": ["ビタミンC", "アスコルビ"],
  "パンテノール": ["パンテノール"],
  "トラネキサム酸": ["トラネキサム"],
  "レチノール": ["レチノール"],
  "スクワラン": ["スクワラン"],
  "PDRN": ["PDRN"],
  "コメ発酵液": ["米発酵", "コメ発酵"],
  "PHA": ["PHA"],
  "マイクロニードル": ["ニードル"],
};

/** 마케팅 소구가 아닌 기제·보존제 */
const BASE_INGREDIENTS = ["水", "精製水", "BG", "DPG", "グリセリン", "フェノキシエタノール", "ペンチレングリコール", "エタノール"];

/** 전각·반각, 공백 차이로 대조가 틀리지 않게 맞춘다 */
export function fold(s: string): string {
  return s.normalize("NFKC").toUpperCase().replace(/\s+/g, "");
}

/** 사전에 있는 성분이면 통일 이름, 없으면 null (검색 자동완성 분류에도 쓴다) */
export function matchIngredient(text: string): string | null {
  const folded = fold(text);
  for (const [canonical, aliases] of Object.entries(INGREDIENT_ALIASES)) {
    if (aliases.some((a) => folded.includes(fold(a)))) return canonical;
  }
  return null;
}

export function canonicalIngredient(nameJa: string, evidenceJa = ""): string {
  return matchIngredient(nameJa) ?? matchIngredient(evidenceJa) ?? nameJa.trim();
}

function isBaseIngredient(nameJa: string): boolean {
  const folded = fold(nameJa);
  return BASE_INGREDIENTS.some((b) => folded === fold(b));
}

export type VerifiedAppeal = Omit<AppealAnalysis, "model" | "prompt_version" | "analyzed_at">;

/** 원문(ocr_text + 크롤링 텍스트)에 근거가 있는 항목만 남긴다 */
export function verifyAppeal(ai: AppealAiOutput, pageText: string): VerifiedAppeal {
  const haystack = fold(`${ai.ocr_text}\n${pageText}`);
  const found = (quote: string) => {
    const q = fold(quote);
    return q.length > 0 && haystack.includes(q);
  };
  let rejected = 0;
  const keep = <T>(items: T[], quote: (x: T) => string) =>
    items.filter((x) => {
      const ok = found(quote(x));
      if (!ok) rejected += 1;
      return ok;
    });

  const heroes = keep(ai.hero_ingredients, (h) => h.evidence_ja)
    .filter((h) => !isBaseIngredient(h.name_ja))
    .map((h) => ({ name_ja: h.name_ja.trim(), canonical: canonicalIngredient(h.name_ja, h.evidence_ja), evidence_ja: h.evidence_ja.trim() }));
  const seen = new Set<string>();
  const hero_ingredients = heroes.filter((h) => !seen.has(h.canonical) && seen.add(h.canonical)).slice(0, 5);

  return {
    ocr_text: ai.ocr_text,
    hero_ingredients,
    skin_concerns: keep(ai.skin_concerns, (c) => c.evidence_ja),
    promo_hooks: keep(ai.promo_hooks, (h) => h.text_ja),
    rejected_count: rejected,
  };
}
