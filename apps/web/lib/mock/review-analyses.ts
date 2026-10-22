import { ReviewAnalysis } from "@/lib/schemas/review";
import { parseAll, ts } from "./helpers";
import { reviews } from "./reviews";

type Seed = {
  sentiment: "positive" | "negative" | "neutral";
  keywords: { text: string; category: "ingredient" | "texture" | "price" | "scent" | "skin_reaction" | "other" }[];
  pain_points?: string[];
  repurchase_factors?: string[];
};

const seeds: Record<string, Seed> = {
  "r-ko-1": { sentiment: "positive", keywords: [{ text: "촉촉", category: "texture" }], repurchase_factors: ["순한 사용감"] },
  "r-ko-2": { sentiment: "neutral", keywords: [{ text: "흡수", category: "texture" }, { text: "향", category: "scent" }], pain_points: ["향"] },
  "r-ko-3": { sentiment: "negative", keywords: [{ text: "따가움", category: "skin_reaction" }], pain_points: ["자극"] },
  "r-ko-4": { sentiment: "positive", keywords: [{ text: "용량", category: "price" }], repurchase_factors: ["가격 대비 용량"] },
  "r-ko-5": { sentiment: "positive", keywords: [{ text: "진정", category: "skin_reaction" }], repurchase_factors: ["진정 효과"] },
  "r-ja-1": { sentiment: "positive", keywords: [{ text: "さっぱり", category: "texture" }] },
  "r-ja-2": { sentiment: "negative", keywords: [{ text: "べたつき", category: "texture" }], pain_points: ["べたつき"] },
  "r-ja-3": { sentiment: "neutral", keywords: [{ text: "保湿", category: "texture" }, { text: "容量", category: "price" }], pain_points: ["容量"] },
  "r-ja-4": { sentiment: "negative", keywords: [{ text: "香り", category: "scent" }], pain_points: ["香り"] },
  "r-ja-5": { sentiment: "positive", keywords: [{ text: "価格", category: "price" }], repurchase_factors: ["価格"] },
};

export const reviewAnalyses = parseAll(
  ReviewAnalysis,
  reviews.map((r) => {
    const s = seeds[r.id];
    return {
      id: `ra-${r.id}`,
      created_at: ts("2026-10-20"),
      review_id: r.id,
      sentiment: s?.sentiment ?? "neutral",
      keywords: s?.keywords ?? [],
      pain_points: s?.pain_points ?? [],
      repurchase_factors: s?.repurchase_factors ?? [],
      model: "claude-haiku-5-5",
      prompt_version: "review-analysis.v1",
    };
  }),
  "reviewAnalyses",
);
