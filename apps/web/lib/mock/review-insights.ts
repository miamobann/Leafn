import { ReviewInsight } from "@/lib/schemas/review";
import { parseAll, ts, WORKSPACE_ID } from "./helpers";

export const reviewInsights = parseAll(
  ReviewInsight,
  [
    { id: "ri-1", product_id: "p-own-1", kind: "repurchase_factor", label: "순한 사용감", count: 2, evidence_review_ids: ["r-ko-1", "r-ko-5"] },
    { id: "ri-2", product_id: "p-own-1", kind: "repurchase_factor", label: "가격 대비 용량", count: 1, evidence_review_ids: ["r-ko-4"] },
    { id: "ri-3", product_id: "p-own-1", kind: "pain_point", label: "자극", count: 1, evidence_review_ids: ["r-ko-3"] },
    { id: "ri-4", product_id: "p-comp-1", kind: "pain_point", label: "べたつき", label_ko: "끈적임", count: 1, evidence_review_ids: ["r-ja-2"] },
    { id: "ri-5", product_id: "p-comp-2", kind: "pain_point", label: "香り", label_ko: "향", count: 1, evidence_review_ids: ["r-ja-4"] },
  ].map((r) => ({ ...r, workspace_id: WORKSPACE_ID, created_at: ts("2026-10-20") })),
  "reviewInsights",
);
