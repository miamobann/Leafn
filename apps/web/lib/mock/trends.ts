import { TrendSnapshot } from "@/lib/schemas/trend";
import { OWN_BRAND, ownProductName } from "@/lib/own-products";
import { findBanner, qoo10Banners, sampleAppeal } from "./appeal-samples";
import { parseAll, ts, WORKSPACE_ID } from "./helpers";

// 楽天ランキング 화면의 항목 구성을 흉내 낸 합성 시계열 (샘플)
// 3개 카테고리 × 12주 (매주 월요일), 성분 10개 (prototype-plan P3)
// 순위는 고정 식(기준 점수 + 주별 기울기 + 고정 흔들림)으로 만들어 빌드마다 같다

const WEEK_COUNT = 12;
const FIRST_MONDAY = "2026-08-03";

function addDays(date: string, days: number): string {
  const t = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** -1 ~ 1 사이의 고정 흔들림 */
function wiggle(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

const weeks = Array.from({ length: WEEK_COUNT }, (_, w) => addDays(FIRST_MONDAY, w * 7));

// [brand, name, price_jpy, 기준 리뷰 수, K-뷰티 여부, 기준 점수, 주별 기울기, (선택) 처음 나오는 주]
// 자사·경쟁 제품(lib/mock/products.ts)과 brand·name이 같으면 제품 상세에서 순위 추이로 이어진다
// 각 카테고리 뒤쪽 후보는 Top 20 경계(15~26위)를 오가는 하위권·신제품 (랭킹 역동성 카드용). 化粧水는 이미지 분석 샘플이 있는 상위 10을 침범하지 않게 점수를 낮게 둔다
type Candidate = [string, string, number, number, boolean, number, number, number?];

const CANDIDATES: Record<string, Candidate[]> = {
  "化粧水": [
    ["SampleA", "ドクダミ化粧水", 1980, 3900, true, 95, 0.3],
    ["SampleJ", "薬用ローション", 1650, 3400, false, 96, -0.25],
    ["SampleB", "セラミドトナー", 2750, 2100, true, 88, 0.5],
    ["SampleG", "ヒアルロン酸ローション", 1650, 1700, true, 90, 0.4],
    ["SampleK", "高保湿化粧水", 1320, 2900, false, 92, -0.4],
    ["SampleL", "拭き取り化粧水", 1650, 900, false, 80, 0.6],
    ["SampleM", "パンテノールトナー", 1790, 700, true, 78, 0.9],
    ["SampleN", "ライストナー", 1980, 650, true, 82, 0.2],
    ["SampleP", "うるおいローション", 1100, 4100, false, 86, -0.3],
    ["SampleQ", "毛穴ケアトナー", 1890, 520, true, 74, 0.7],
    ["SampleR", "しっとり化粧水", 1540, 2200, false, 84, -0.1],
    ["SampleS", "シカトナー", 2200, 1100, true, 81, 0.1],
    ["SampleT", "敏感肌用化粧水", 2090, 1300, false, 79, 0],
    ["SampleU", "ビタミントナー", 2420, 480, true, 70, 0.8],
    ["SampleV", "導入化粧水", 2970, 760, false, 76, 0.2],
    ["SampleBA", "アゼライン酸トナー", 2380, 120, true, 62, 1.1, 3],
    ["SampleBB", "PDRNトナー", 2680, 90, true, 60, 1.4, 5],
    ["SampleBC", "酵素化粧水", 1480, 800, false, 71, -0.3],
    ["SampleBD", "グリーンティートナー", 1650, 600, true, 69, 0.1],
    ["SampleBE", "ハトムギローション", 990, 2500, false, 72, -0.4],
    ["SampleBF", "ガラクトミセストナー", 2200, 300, true, 66, 0.4],
    ["SampleBG", "ペプチドトナー", 2900, 150, true, 58, 1.2, 6],
    ["SampleBH", "弱酸性化粧水", 1320, 900, false, 70, -0.2],
    ["SampleBI", "ミルクトナー", 1890, 400, true, 64, 0.6, 2],
    ["SampleBJ", "オイルインローション", 2100, 500, false, 68, 0],
    ["SampleBK", "ブライトニングトナー", 2480, 200, true, 61, 0.9, 4],
  ],
  "美容液": [
    [OWN_BRAND, ownProductName("core-essence"), 2980, 380, true, 66, 1.6],
    ["SampleD", "セラミドアンプル", 2640, 2800, true, 94, 0.3],
    ["SampleE", "ナイアシンアミド美容液", 3300, 620, false, 88, 0.1],
    ["SampleF", "レチノールセラム", 2890, 1400, true, 85, 0.4],
    ["SampleH", "ビタミンC美容液", 3850, 360, false, 83, -0.2],
    ["SampleW", "ビタミン美容液", 2970, 4400, false, 97, -0.2],
    ["SampleX", "導入美容液", 3520, 3300, false, 93, -0.3],
    ["SampleY", "ドクダミアンプル", 2480, 2190, true, 90, 0.2],
    ["SampleZ", "ハリ美容液", 3960, 1420, false, 86, -0.4],
    ["SampleAA", "シカアンプル", 2190, 870, true, 77, 0.9],
    ["SampleAB", "高保湿セラム", 2640, 2050, false, 84, 0],
    ["SampleAC", "ペプチドセラム", 3080, 980, true, 78, 0.5],
    ["SampleAD", "毛穴美容液", 2750, 1100, false, 80, -0.1],
    ["SampleAE", "美容オイル", 3300, 600, false, 72, 0.1],
    ["SampleAF", "ヒアルロン酸アンプル", 2290, 760, true, 75, 0.6],
    ["SampleCA", "グルタチオン美容液", 3300, 140, true, 63, 1.0, 2],
    ["SampleCB", "エクソソームアンプル", 4200, 80, true, 58, 1.5, 4],
    ["SampleCC", "スクワランオイル", 2200, 900, false, 70, -0.2],
    ["SampleCD", "トラネキサム酸美容液", 2750, 700, false, 69, 0.2],
    ["SampleCE", "ナイアシン導入液", 2480, 300, true, 65, 0.5],
    ["SampleCF", "ビタミンAセラム", 3100, 250, false, 67, 0.3],
    ["SampleCG", "発酵エッセンス", 2600, 500, true, 68, -0.1],
    ["SampleCH", "アゼライン酸セラム", 2640, 120, true, 60, 1.2, 5],
    ["SampleCI", "マイクロニードル美容液", 3800, 90, true, 57, 1.6, 6],
    ["SampleCJ", "保湿ブースター", 1980, 1100, false, 71, -0.3],
    ["SampleCK", "ハーブアンプル", 2300, 200, true, 62, 0.4],
  ],
  "クリーム": [
    ["SampleK", "保湿クリーム", 1980, 6020, false, 97, -0.1],
    ["SampleAG", "シカクリーム", 2380, 2640, true, 92, 0.4],
    ["SampleZ", "セラミドクリーム", 2750, 3110, false, 93, 0],
    ["SampleAH", "パンテノールクリーム", 2190, 1530, true, 86, 0.5],
    ["SampleX", "オールインワンジェル", 3300, 4870, false, 90, -0.3],
    ["SampleW", "夜用クリーム", 3850, 1290, false, 88, -0.2],
    ["SampleN", "水分クリーム", 2090, 990, true, 80, 0.6],
    ["SampleR", "バームクリーム", 1650, 1840, false, 84, -0.1],
    ["SampleL", "ナイトマスク", 2420, 1100, false, 82, 0],
    ["SampleB", "バリアクリーム", 2290, 760, true, 76, 0.8],
    ["SampleT", "敏感肌クリーム", 2640, 900, false, 79, 0],
    ["SampleU", "ビタミンクリーム", 2860, 420, true, 72, 0.4],
    ["SampleDA", "PDRNクリーム", 3200, 100, true, 60, 1.3, 3],
    ["SampleDB", "ペプチドクリーム", 3600, 200, true, 63, 0.8],
    ["SampleDC", "ドクダミクリーム", 2200, 600, true, 68, 0.3],
    ["SampleDD", "尿素クリーム", 980, 3000, false, 74, -0.3],
    ["SampleDE", "ジェルクリーム", 1650, 900, false, 71, 0],
    ["SampleDF", "ナイアシンクリーム", 2480, 300, true, 65, 0.5],
    ["SampleDG", "スクワランバーム", 2750, 400, false, 67, 0.1],
    ["SampleDH", "トーンアップクリーム", 2900, 500, true, 66, 0.4],
    ["SampleDI", "レチノールクリーム", 3300, 250, false, 64, 0.6, 2],
    ["SampleDJ", "アイクリーム", 3850, 700, false, 70, -0.2],
    ["SampleDK", "ハンドバーム", 1200, 1500, false, 69, -0.1],
    ["SampleDL", "エクソソームクリーム", 4400, 60, true, 56, 1.7, 5],
    ["SampleDM", "ミルククリーム", 1980, 800, true, 62, 0.5],
    ["SampleDN", "グリーンティークリーム", 2100, 350, true, 61, 0.7, 4],
  ],
};

// [성분, 기준 언급 수, 12주 동안 늘어나는 수] · 랭킹 상품명·설명 기준 (TECH_STACK 13장 5번)
const INGREDIENTS: [string, number, number][] = [
  ["ヒアルロン酸", 160, 26],
  ["セラミド", 120, 51],
  ["ナイアシンアミド", 98, 56],
  ["ツボクサエキス", 140, -2],
  ["レチノール", 70, 51],
  ["ビタミンC誘導体", 105, 7],
  ["ドクダミエキス", 60, 36],
  ["パンテノール", 52, 32],
  ["トラネキサム酸", 66, 14],
  ["スクワラン", 44, 14],
];
const CATEGORY_SCALE: Record<string, number> = { "化粧水": 1, "美容液": 0.85, "クリーム": 0.55 };

// 상세 이미지 분석 샘플은 化粧水 최신 주 상위 10개에만 붙인다 (문구: ranking-banners.json)
const APPEAL_CATEGORY = "化粧水";
const APPEAL_TOP_N = 10;

function appealFor(brand: string, name: string, capturedAt: string) {
  const banner = findBanner("rakuten_ranking", brand, name);
  return banner ? sampleAppeal(banner, capturedAt) : undefined;
}

const rakutenSnapshots = parseAll(
  TrendSnapshot,
  Object.entries(CANDIDATES).flatMap(([category, candidates], c) =>
    weeks.map((date, w) => {
      const ranking = candidates
        .map(([brand, name, price_jpy, reviews, is_kbeauty, base, slope, start = 0], i) => ({
          brand,
          name,
          price_jpy,
          review_count: Math.round(reviews * (1 + 0.02 * w)),
          is_kbeauty,
          start,
          score: base + slope * w + wiggle(c * 1000 + i * 37 + w) * 1.5,
        }))
        // 신제품은 출시 주부터 랭킹에 나온다 (흔들림 seed는 원래 순서 i로 고정해 기존 후보 순위가 바뀌지 않게)
        .filter((item) => w >= item.start)
        .toSorted((a, b) => b.score - a.score)
        .map((item, r) => ({
          rank: r + 1,
          name: item.name,
          brand: item.brand,
          price_jpy: item.price_jpy,
          review_count: item.review_count,
          is_kbeauty: item.is_kbeauty,
          appeal:
            category === APPEAL_CATEGORY && w === WEEK_COUNT - 1 && r < APPEAL_TOP_N
              ? appealFor(item.brand, item.name, ts(date, "06:00"))
              : undefined,
        }));
      const ingredients = INGREDIENTS.map(([ingredient, start, growth], i) => ({
        ingredient,
        count: Math.max(0, Math.round((start + (growth * w) / (WEEK_COUNT - 1) + wiggle(c * 500 + i * 13 + w) * 5) * CATEGORY_SCALE[category])),
      })).toSorted((a, b) => b.count - a.count);
      return {
        id: `ts-${c + 1}-${w + 1}`,
        workspace_id: WORKSPACE_ID,
        created_at: ts(date, "06:00"),
        captured_at: ts(date, "06:00"),
        source: "rakuten_ranking",
        category,
        data: { ranking, ingredients },
      };
    }),
  ),
  "trendSnapshots",
);

// Qoo10 化粧水 최신 주 1회분 (더미 크롤링 결과). 楽天과 같은 제품이 있어도 합치지 않는다
const LAST_WEEK = weeks[WEEK_COUNT - 1];
const qoo10Snapshots = parseAll(
  TrendSnapshot,
  [
    {
      id: "ts-qoo10-1",
      workspace_id: WORKSPACE_ID,
      created_at: ts(LAST_WEEK, "07:00"),
      captured_at: ts(LAST_WEEK, "07:00"),
      source: "qoo10_ranking",
      category: APPEAL_CATEGORY,
      data: {
        ranking: qoo10Banners.map((b) => ({
          rank: b.rank,
          name: b.name,
          brand: b.brand,
          price_jpy: b.price_jpy,
          review_count: b.review_count,
          is_kbeauty: b.is_kbeauty,
          appeal: b.rank <= APPEAL_TOP_N ? sampleAppeal(b, ts(LAST_WEEK, "07:00")) : undefined,
        })),
        ingredients: [],
      },
    },
  ],
  "qoo10Snapshots",
);

export const trendSnapshots = [...rakutenSnapshots, ...qoo10Snapshots];
