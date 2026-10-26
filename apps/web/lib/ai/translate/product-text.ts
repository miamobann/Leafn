// 일본어 상품명·특징·문구 → 한국어 (callAi 대량 등급, JSON 스키마 출력). 경쟁제품 1:1 비교에서 원문 아래 회색 해석으로 보여 준다.
// 응답은 Zod로 검증하고 실패하면 1회 재시도 (CLAUDE.md 7장). 입력에 없는 말은 버린다. 결과는 저장하지 않는다
import { TermTranslation } from "@/lib/schemas/search";
import { callAi } from "../client";
import { loadPrompt } from "../prompts";

export const PRODUCT_TEXT_PROMPT_VERSION = 1;

function parse(text: string): TermTranslation | null {
  try {
    const checked = TermTranslation.safeParse(JSON.parse(text));
    return checked.success ? checked.data : null;
  } catch {
    return null;
  }
}

/** 일본어 문구 → 한국어. 번역하지 못한 문구는 결과에 없다 */
export async function translateProductTexts(texts: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(texts.map((t) => t.trim()).filter(Boolean))];
  if (unique.length === 0) return new Map();
  const { text: system } = await loadPrompt("product-text-translate", PRODUCT_TEXT_PROMPT_VERSION);
  const request = () => callAi({ grade: "bulk", system, user: JSON.stringify({ texts: unique }), schema: { name: "product_text_translation", zod: TermTranslation } });
  let out = parse((await request()).text);
  if (!out) out = parse((await request()).text);
  if (!out) return new Map();
  const asked = new Set(unique);
  return new Map(out.items.filter((i) => asked.has(i.ja) && i.ko.trim()).map((i) => [i.ja, i.ko.trim()]));
}
