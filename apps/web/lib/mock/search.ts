import { SearchSnapshot } from "@/lib/schemas/search";
import { AUTOCOMPLETE_REGION, AUTOCOMPLETE_SEEDS, TRENDS_CATEGORIES, TRENDS_INGREDIENT_TERMS } from "@/lib/external/search-terms";
import { parseAll, ts, WORKSPACE_ID } from "./helpers";

// Google 자동완성(일본) 화면의 항목 구성을 흉내 낸 합성 시계열 (샘플)
// 시드 4개 × 8주 (매주 월요일, 마지막 주 = 시장 트렌드 샘플의 마지막 주). 매주 점수 상위 10개가 자동완성 목록이 된다

const WEEKS = ["2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19"];

/** -1 ~ 1 사이의 고정 흔들림 */
function wiggle(seed: number): number {
  const x = Math.sin(seed * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

// [시드 뒤에 붙는 말, 기준 점수, 주별 기울기, 처음 나오는 주(0부터)]
const TERMS: [string, number, number, number][] = [
  ["おすすめ", 9.5, 0, 0],
  ["ドラッグストア", 8, 0, 0],
  ["ランキング", 7.5, 0, 0],
  ["プチプラ", 7, -0.05, 0],
  ["乾燥肌", 7.2, 0, 0],
  ["毛穴", 7, 0.05, 0],
  ["セラミド", 6.8, 0.05, 0],
  ["ヒアルロン酸", 6.5, -0.05, 0],
  ["シカ", 6.2, -0.2, 0],
  ["ビタミンC", 6, -0.15, 0],
  ["ニキビ", 6, 0.05, 0],
  ["敏感肌", 5.5, 0, 0],
  ["使い方", 5, -0.1, 0],
  ["トラネキサム酸", 5, 0, 0],
  ["ナイアシンアミド", 5, 0.3, 0],
  ["ドクダミ", 4.8, 0.25, 0],
  ["レチノール", 4.5, 0.45, 0],
  ["美白", 4.5, 0.2, 0],
  ["PDRN", 3, 0.7, 3],
  ["アゼライン酸", 2.5, 0.6, 4],
];

const autocompleteSnapshots = parseAll(
  SearchSnapshot,
  WEEKS.flatMap((date, w) =>
    AUTOCOMPLETE_SEEDS.map((seed, s) => {
      const suggestions = TERMS.filter(([, , , start]) => w >= start)
        .map(([term, base, slope], i) => ({ term, score: base + slope * w + wiggle(s * 100 + i * 7 + w) * 0.8 }))
        .toSorted((a, b) => b.score - a.score)
        .slice(0, 10)
        .map((t, i) => ({ value: `${seed.trim()} ${t.term}`, position: i + 1, relevance: Math.round(1250 - i * 50) }));
      return {
        id: `ss-${w + 1}-${s + 1}`,
        workspace_id: WORKSPACE_ID,
        created_at: ts(date, "08:00"),
        engine: "google_autocomplete",
        seed,
        ...AUTOCOMPLETE_REGION,
        captured_at: ts(date, "08:00"),
        suggestions,
      };
    }),
  ),
  "searchSnapshots",
);

// Google Trends 성분 검색 관심도 (샘플): 카테고리 4개 × 2주. 「카테고리 + 성분」 검색어의 상대 관심도 (1위 = 100)
// [기준 관심도, 2주 사이 변화] · 순서는 TRENDS_INGREDIENT_TERMS와 같다
const TRENDS_BASE: [number, number][] = [
  [100, -6], [82, 2], [64, 9], [58, 14], [52, -3], [47, -8], [40, 6], [31, 3], [28, 0], [18, -1], [9, 11], [5, 6],
];
const TRENDS_WEEKS = ["2026-10-12", "2026-10-19"];
const CATEGORY_SHIFT: Record<string, number> = { "化粧水": 0, "美容液": 3, "クリーム": 5, "日焼け止め": 7 };

const trendsSnapshots = parseAll(
  SearchSnapshot,
  TRENDS_CATEGORIES.flatMap((category, c) =>
    TRENDS_WEEKS.map((date, w) => {
      const raw = TRENDS_INGREDIENT_TERMS.map((term, i) => {
        const [base, change] = TRENDS_BASE[(i + CATEGORY_SHIFT[category]) % TRENDS_BASE.length];
        return { value: `${category} ${term}`, v: Math.max(0, base + change * w + wiggle(c * 50 + i) * 3) };
      });
      const max = Math.max(...raw.map((r) => r.v));
      const suggestions = raw
        .map((r) => ({ value: r.value, interest: Math.round((r.v / max) * 100) }))
        .toSorted((a, b) => b.interest - a.interest)
        .map((r, i) => ({ value: r.value, position: i + 1, relevance: r.interest }));
      return {
        id: `st-${c + 1}-${w + 1}`,
        workspace_id: WORKSPACE_ID,
        created_at: ts(date, "08:30"),
        engine: "google_trends",
        seed: category,
        gl: "jp",
        hl: "ja",
        captured_at: ts(date, "08:30"),
        suggestions,
      };
    }),
  ),
  "trendsSnapshots",
);

export const searchSnapshots = [...autocompleteSnapshots, ...trendsSnapshots];
