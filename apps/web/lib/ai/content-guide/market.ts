// 콘텐츠 제작 가이드에 넣을 시장 분석 재료 (AI 호출 없음). 시장 탭의 저장 데이터를 읽기만 한다.
// 약기법이 항상 먼저: 성분은 우리 전성분에 실제로 있는 것만 넘긴다 (없는 성분을 쓰면 성분 허위 표시, 가이드라인 F5.1).
import { TRENDS_INGREDIENT_TERMS } from "@/lib/external/search-terms";
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

// ── 검색어 · 요즘 뜨는 말 (피부 고민 자동완성) ──────────────────────
// 자동완성은 피부 고민 단어(lib/external/search-terms.ts CONCERN_SEEDS)로 모은다. 제품 피부 라인에 맞는 고민만 쓴다.
// 약기법: 「顔 シミ」「美白」「肌 鎮静」「毛穴」 시드는 쓰지 않는다 (잡티·미백은 화장품 효능 범위 밖, 진정은 의약품적 표현).
// 그 밖의 시드에서도 질환·효능을 말하는 추천어는 빼고 넘긴다 (프롬프트·자동 약기법 검사 전에 한 번 더 거른다).

export type SkinLineKey = "dry" | "oily" | "combo";

// 「毛穴」도 쓰지 않는다: 금지어 검사(lint.ts)가 효능 범위 밖 표현(E8)으로 잡는 말이라 넣으면 결과마다 경고가 난다
const SAFE_SEEDS: Record<SkinLineKey, string[]> = {
  dry: ["肌 キメ", "肌 バリア"],
  oily: ["皮脂", "肌 キメ"],
  combo: ["肌 キメ", "肌 バリア", "皮脂"],
};
const ALL_SAFE_SEEDS = [...new Set(Object.values(SAFE_SEEDS).flat())];

/** 화장품 광고에 쓸 수 없는 말 (질환·치료·효능 보증). 하나라도 있으면 그 추천어는 넘기지 않는다 */
const RISKY_TERM = /回復|毛穴|シミ|しみ|美白|ホワイトニング|鎮静|ニキビ|にきび|治|消え|消す|アトピー|しわ|シワ|肝斑|そばかす|炎症|赤み|薬|改善|効果|効く|再生|機能|医/;

/** 추천어에 성분 이름이 있으면 우리 전성분에 그 성분이 있을 때만 넘긴다 (없는 성분을 들어간 것처럼 보이게 하지 않는다, 가이드라인 F5.1) */
function hasOnlyOwnIngredients(word: string, ownIngredients: string[]): boolean {
  const w = normalize(word);
  return TRENDS_INGREDIENT_TERMS.every((term) => !w.includes(normalize(term)) || ownIngredients.some((name) => normalize(name).includes(normalize(term))));
}

/** AI에 넘기는 수 */
export const MAX_SEARCH_WORDS = 5;
export const MAX_TRENDING_WORDS = 3;

/**
 * 피부 라인에 맞는 고민 시드의 자동완성에서
 * - search: 가장 최근 수집의 상위 추천어 (시드를 돌아가며, 최대 5개)
 * - trending: 지난 수집에는 없고 이번에 새로 나타난 추천어 (최대 3개, SNS 트렌드용)
 * 를 고른다. 위험한 말과 우리 전성분에 없는 성분이 든 말은 둘 다에서 뺀다. 피부 라인을 모르면 안전한 시드 전체를 쓴다.
 */
export function pickSearchWords(snapshots: SearchSnapshot[], skinLine: SkinLineKey | null, ownIngredients: string[]): { search: string[]; trending: string[] } {
  const seeds = skinLine ? SAFE_SEEDS[skinLine] : ALL_SAFE_SEEDS;
  const perSeed = seeds.map((seed) => {
    const series = snapshots
      .filter((s) => s.engine === "google_autocomplete" && normalize(s.seed) === normalize(seed))
      .toSorted((a, b) => a.captured_at.localeCompare(b.captured_at));
    const latest = series.at(-1);
    const prev = series.at(-2);
    const prevValues = new Set((prev?.suggestions ?? []).map((s) => normalize(s.value)));
    const words = (latest?.suggestions ?? [])
      .toSorted((a, b) => a.position - b.position)
      .map((s) => s.value.trim())
      .filter((v) => v && !RISKY_TERM.test(v) && hasOnlyOwnIngredients(v, ownIngredients));
    return { words, fresh: prev ? words.filter((v) => !prevValues.has(normalize(v))) : [] };
  });
  const roundRobin = (lists: string[][], max: number) => {
    const out: string[] = [];
    for (let i = 0; out.length < max && lists.some((l) => i < l.length); i++) {
      for (const l of lists) if (l[i] && !out.includes(l[i]) && out.length < max) out.push(l[i]);
    }
    return out;
  };
  const trending = roundRobin(perSeed.map((p) => p.fresh), MAX_TRENDING_WORDS);
  const search = roundRobin(perSeed.map((p) => p.words.filter((w) => !trending.includes(w))), MAX_SEARCH_WORDS);
  return { search, trending };
}
