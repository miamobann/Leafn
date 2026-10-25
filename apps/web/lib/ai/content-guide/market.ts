// 콘텐츠 제작 가이드에 넣을 시장 분석 재료 (AI 호출 없음). 시장 탭의 저장 데이터를 읽기만 한다.
// 약기법이 항상 먼저: 성분은 우리 전성분에 실제로 있는 것만 넘긴다 (없는 성분을 쓰면 성분 허위 표시, 가이드라인 F5.1).
import type { SearchSnapshot } from "@/lib/schemas/search";

/** AI에 넘기는 관심 성분 수 */
export const MAX_TREND_INGREDIENTS = 3;

const normalize = (s: string) => s.replace(/\s+/g, "");

/**
 * 관심 성분: Google Trends 「카테고리 + 성분」 검색 관심도(가장 최근 수집) 순서대로, 우리 전성분에 들어 있는 성분만 고른다.
 * 돌려주는 이름은 우리 전성분 표기 그대로 (예: 관심 검색어 「ヒアルロン酸」 → 전성분 「ヒアルロン酸Na」).
 * category 는 Google Trends 수집 단위(化粧水·美容液 …). 수집이 없는 카테고리(乳液 등)는 빈 배열.
 */
export function pickTrendIngredients(snapshots: SearchSnapshot[], category: string, ownIngredients: string[]): string[] {
  const latest = snapshots
    .filter((s) => s.engine === "google_trends" && s.seed === category)
    .toSorted((a, b) => a.captured_at.localeCompare(b.captured_at))
    .at(-1);
  if (!latest) return [];
  const picked: string[] = [];
  for (const s of latest.suggestions.toSorted((a, b) => a.position - b.position)) {
    const term = normalize(s.value.startsWith(category) ? s.value.slice(category.length) : s.value);
    if (!term) continue;
    const own = ownIngredients.find((name) => normalize(name).includes(term));
    if (own && !picked.includes(own)) picked.push(own);
    if (picked.length >= MAX_TREND_INGREDIENTS) break;
  }
  return picked;
}
