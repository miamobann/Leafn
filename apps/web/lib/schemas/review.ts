import { z } from "zod";
import { AiMeta, BaseRow, Id, Lang, Sentiment, Timestamp, WorkspaceRow } from "./common";

export const ReviewSource = z.enum(["cosme", "rakuten", "qoo10", "oliveyoung", "csv"]);
export type ReviewSource = z.infer<typeof ReviewSource>;

export const Review = WorkspaceRow.extend({
  product_id: Id,
  source: ReviewSource,
  external_id: z.string(),
  lang: Lang,
  rating: z.number().min(0),
  body: z.string(),
  posted_at: Timestamp,
  raw: z.record(z.string(), z.unknown()).nullable(),
  // 제안: docs/prototype-plan.md 8장 7번 (body_ko), 8번 (평점 척도), 9번 (작성자 속성)
  body_ko: z.string().optional(),
  rating_scale: z.number().int().positive().optional(),
  reviewer_attrs: z
    .object({ age_group: z.string().optional(), skin_type: z.string().optional() })
    .optional(),
});
export type Review = z.infer<typeof Review>;

// 제안: 8장 6번 — 키워드를 카테고리와 함께
export const KeywordCategory = z.enum(["ingredient", "texture", "price", "scent", "skin_reaction", "other"]);
export const Keyword = z.object({ text: z.string(), category: KeywordCategory });

export const ReviewAnalysis = BaseRow.merge(AiMeta).extend({
  review_id: Id,
  sentiment: Sentiment,
  keywords: z.array(Keyword),
  pain_points: z.array(z.string()),
  repurchase_factors: z.array(z.string()),
});
export type ReviewAnalysis = z.infer<typeof ReviewAnalysis>;

export const ReviewInsight = WorkspaceRow.extend({
  product_id: Id,
  kind: z.enum(["pain_point", "repurchase_factor", "keyword"]),
  label: z.string(),
  count: z.number().int().nonnegative(),
  evidence_review_ids: z.array(Id),
  // 제안: 8장 7번
  label_ko: z.string().optional(),
});
export type ReviewInsight = z.infer<typeof ReviewInsight>;

// (참조 F)
export const ReviewTranslation = BaseRow.extend({
  review_id: Id,
  text_ja: z.string(),
  ad_check_id: Id.nullable(),
  status: z.enum(["draft", "approved"]),
});
export type ReviewTranslation = z.infer<typeof ReviewTranslation>;
