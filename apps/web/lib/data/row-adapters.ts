import { AdCheck, AdCheckLineRow } from "@/lib/schemas/ad-check";
import { Product } from "@/lib/schemas/product";
import { Review, ReviewAnalysis, type ReviewInsight } from "@/lib/schemas/review";

export function productFromRow(row: Record<string, unknown>) {
  return Product.parse({ ...row, platform: row.platform_id, category: row.category ?? undefined });
}

export function reviewFromRow(row: Record<string, unknown>) {
  return Review.parse({ ...row, posted_at: row.posted_at ?? row.created_at,
    rating_scale: row.rating_scale ?? undefined, body_ko: row.body_ko ?? undefined, reviewer_attrs: row.reviewer_attrs ?? undefined });
}

export function analysisFromRow(row: Record<string, unknown>) {
  const parsed = ReviewAnalysis.safeParse({ ...row, topics: row.topics ?? undefined });
  return parsed.success ? parsed.data : null;
}

export function adCheckFromRow(row: Record<string, unknown>, lineRows: Record<string, unknown>[] = []) {
  const parsedLines = lineRows
    .map((l) => AdCheckLineRow.parse(l))
    .sort((a, b) => a.line_index - b.line_index);
  const hasLines = parsedLines.length > 0;
  const lineResults = hasLines
    ? parsedLines.map((l) => ({
        line_index: l.line_index,
        original: l.original,
        action: l.action,
        ingredient_check: l.ingredient_check ?? "",
        translated_text: l.translated_text,
        back_translation_ko: l.back_translation_ko,
        localized_note: l.localized_note ?? "",
      }))
    : Array.isArray(row.line_results)
      ? row.line_results
      : null;
  const findings = hasLines
    ? parsedLines.flatMap((l) => l.findings.map((f) => ({ ...f, line_index: f.line_index ?? l.line_index })))
    : Array.isArray(row.findings)
      ? row.findings
      : [];
  const translated = hasLines
    ? parsedLines.map((l) => l.translated_text).filter(Boolean).join("\n") || undefined
    : (row.translated_text ?? undefined);
  const backTranslation = hasLines
    ? parsedLines.map((l) => l.back_translation_ko).filter(Boolean).join("\n") || undefined
    : (row.back_translation_ko ?? undefined);
  const localizedNote = hasLines
    ? parsedLines.map((l) => l.localized_note).filter(Boolean).join("\n") || undefined
    : (row.localized_note ?? undefined);

  return AdCheck.parse({
    ...row,
    findings,
    line_results: lineResults,
    suggestions: Array.isArray(row.suggestions) ? row.suggestions : [],
    final_text: row.final_text ?? undefined,
    product_category: row.product_category ?? undefined,
    usage: row.usage ?? undefined,
    translated_text: translated,
    back_translation_ko: backTranslation,
    overall_risk: row.overall_risk ?? undefined,
    localized_note: localizedNote,
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
