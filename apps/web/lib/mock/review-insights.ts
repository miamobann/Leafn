import { APPEAL_TOPICS, ReviewInsight } from "@/lib/schemas/review";
import { parseAll, ts, WORKSPACE_ID } from "./helpers";
import { reviewAnalyses } from "./review-analyses";
import { reviews } from "./reviews";

// 분석 결과 집계를 흉내 낸다: 제품 × 주제 × (불만·재구매 요인)마다 한 행, 근거 리뷰 ID를 남긴다
const groups = new Map<string, { productId: string; kind: "pain_point" | "repurchase_factor"; label: string; labelKo?: string; ids: string[] }>();
for (const r of reviews) {
  const analysis = reviewAnalyses.find((a) => a.review_id === r.id);
  for (const t of analysis?.topics ?? []) {
    const kind = t.polarity === "negative" ? "pain_point" : "repurchase_factor";
    const key = `${r.product_id}|${kind}|${t.topic}`;
    const side = APPEAL_TOPICS[t.topic][t.polarity];
    const group = groups.get(key) ?? {
      productId: r.product_id,
      kind,
      label: side[r.lang],
      labelKo: r.lang === "ja" ? side.ko : undefined,
      ids: [],
    };
    group.ids.push(r.id);
    groups.set(key, group);
  }
}

export const reviewInsights = parseAll(
  ReviewInsight,
  [...groups.values()].map((g, i) => ({
    id: `ri-${i + 1}`,
    product_id: g.productId,
    kind: g.kind,
    label: g.label,
    label_ko: g.labelKo,
    count: g.ids.length,
    evidence_review_ids: g.ids,
    workspace_id: WORKSPACE_ID,
    created_at: ts("2026-10-20"),
  })),
  "reviewInsights",
);
