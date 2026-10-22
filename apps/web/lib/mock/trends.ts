import { TrendSnapshot } from "@/lib/schemas/trend";
import { parseAll, ts, WORKSPACE_ID } from "./helpers";

// 楽天ランキング 화면의 항목 구성을 흉내 낸 합성 시계열 (샘플)
const weeks = ["2026-09-30", "2026-10-07", "2026-10-14", "2026-10-21"];

export const trendSnapshots = parseAll(
  TrendSnapshot,
  weeks.map((date, w) => ({
    id: `ts-${w + 1}`,
    workspace_id: WORKSPACE_ID,
    created_at: ts(date),
    captured_at: ts(date),
    source: "rakuten_ranking",
    category: "化粧水",
    data: {
      ranking: [
        { rank: 1, name: "ドクダミ化粧水", brand: "SampleA", price_jpy: 1980, review_count: 1200 + w * 40, is_kbeauty: true },
        { rank: 2, name: "薬用ローション", brand: "SampleJ", price_jpy: 1650, review_count: 3400, is_kbeauty: false },
        { rank: 3, name: "セラミドトナー", brand: "SampleB", price_jpy: 2750, review_count: 800 + w * 30, is_kbeauty: true },
      ],
      ingredients: [
        { ingredient: "ツボクサエキス", count: 8 + w },
        { ingredient: "セラミド", count: 7 + w },
        { ingredient: "ナイアシンアミド", count: 6 },
        { ingredient: "ドクダミエキス", count: 5 + w },
        { ingredient: "ヒアルロン酸", count: 4 },
      ],
    },
  })),
  "trendSnapshots",
);
