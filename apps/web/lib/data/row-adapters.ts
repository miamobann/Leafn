import { AdCheck } from "@/lib/schemas/ad-check";
import { Product } from "@/lib/schemas/product";
import { Review, ReviewAnalysis, type ReviewInsight } from "@/lib/schemas/review";

export function productFromRow(row: Record<string, unknown>) {
  return Product.parse({ ...row, platform: row.platform_id, category: row.category ?? undefined });
}

export function reviewFromRow(row: Record<string, unknown>) {
  return Review.parse({ ...row, posted_at: row.posted_at ?? row.created_at,
    body_ko: row.body_ko ?? undefined, reviewer_attrs: row.reviewer_attrs ?? undefined });
}

export function analysisFromRow(row: Record<string, unknown>) {
  return ReviewAnalysis.parse({ ...row, topics: row.topics ?? undefined });
}

export function adCheckFromRow(row: Record<string, unknown>) {
  return AdCheck.parse({
    ...row,
    suggestions: Array.isArray(row.suggestions) ? row.suggestions : [],
    final_text: row.final_text ?? undefined,
    product_category: row.product_category ?? undefined,
    usage: row.usage ?? undefined,
    translated_text: row.translated_text ?? undefined,
    back_translation_ko: row.back_translation_ko ?? undefined,
    overall_risk: row.overall_risk ?? undefined,
    localized_note: row.localized_note ?? undefined,
    reviewed_at: row.reviewed_at ?? undefined,
    product_id: row.product_id ?? undefined,
    promo_event_id: row.promo_event_id ?? undefined,
  });
}

/** 같은 리뷰에 같은 표현이 반복돼도 한 번만 집계하고 실제 근거 ID를 유지한다. */
export function summarizeReviews(reviews: (Review & { analysis: ReviewAnalysis | null })[]) {
  const sentiment = { positive: 0, negative: 0, neutral: 0 };
  const groups = new Map<string, ReviewInsight>();
  for (const review of reviews) {
    if (!review.analysis) continue;
    sentiment[review.analysis.sentiment]++;
    const entries: [ReviewInsight["kind"], string[]][] = [
      ["pain_point", review.analysis.pain_points], ["repurchase_factor", review.analysis.repurchase_factors],
      ["keyword", review.analysis.keywords.map((k) => k.text)],
    ];
    for (const [kind, labels] of entries) for (const label of new Set(labels)) {
      const key = JSON.stringify([review.product_id, kind, label]);
      const insight = groups.get(key) ?? { id: key, workspace_id: review.workspace_id,
        created_at: review.created_at, product_id: review.product_id, kind, label, count: 0, evidence_review_ids: [] };
      insight.count++;
      insight.evidence_review_ids.push(review.id);
      groups.set(key, insight);
    }
  }
  return { reviews, sentiment, insights: [...groups.values()].sort((a, b) => b.count - a.count) };
}
