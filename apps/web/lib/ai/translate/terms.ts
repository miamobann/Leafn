// 일본어 검색어 → 한국어 뜻 (callAi 대량 등급, JSON 스키마 출력). 검색 추천어를 수집할 때 한 번에 번역해 같이 저장한다.
// 응답은 Zod로 검증하고 실패하면 1회 재시도 (CLAUDE.md 7장). 입력에 없는 말은 버린다
import { TermTranslation } from "@/lib/schemas/search";
import { callAi } from "../client";
import { loadPrompt } from "../prompts";

function parse(text: string): TermTranslation | null {
  try {
    const checked = TermTranslation.safeParse(JSON.parse(text));
    return checked.success ? checked.data : null;
  } catch {
    return null;
  }
}

/** 검색어 → 한국어 뜻. 번역하지 못한 말은 결과에 없다 */
export async function translateTerms(terms: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(terms.map((t) => t.trim()).filter(Boolean))];
  if (unique.length === 0) return new Map();
  const { text: system } = await loadPrompt("term-translate", 1);
  const request = () => callAi({ grade: "bulk", system, user: JSON.stringify({ terms: unique }), schema: { name: "term_translation", zod: TermTranslation } });
  let out = parse((await request()).text);
  if (!out) out = parse((await request()).text);
  if (!out) return new Map();
  const asked = new Set(unique);
  return new Map(out.items.filter((i) => asked.has(i.ja) && i.ko.trim()).map((i) => [i.ja, i.ko.trim()]));
}
