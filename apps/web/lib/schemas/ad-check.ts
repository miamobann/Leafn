import { z } from "zod";
import { AiMeta, Id, Lang, ReviewStatus, Risk, Timestamp, WorkspaceRow } from "./common";

// 7장 약기법 검토 응답의 findings[] 한 항목
export const AdFinding = z.object({
  text: z.string(),
  risk: Risk,
  reason: z.string(),
  basis: z.string(),
  suggestions: z.array(z.string()),
  // 제안: docs/prototype-plan.md 8장 1번 (원문 내 위치)
  start: z.number().int().nonnegative().optional(),
  end: z.number().int().nonnegative().optional(),
});
export type AdFinding = z.infer<typeof AdFinding>;

// 7장 약기법 검토 응답 (AI 출력 모양)
export const AdCheckResult = z.object({
  overall_risk: Risk,
  findings: z.array(AdFinding),
  localized_note: z.string(),
  // 제안: 8장 4번
  translated_text: z.string().optional(),
  back_translation_ko: z.string().optional(),
});
export type AdCheckResult = z.infer<typeof AdCheckResult>;

export const ProductCategory = z.enum(["general_cosmetic", "quasi_drug"]);
export const AdUsage = z.enum(["detail_page", "sns", "banner", "survey_result"]);

export const AdCheck = WorkspaceRow.merge(AiMeta).extend({
  input_text: z.string(),
  input_lang: Lang,
  findings: z.array(AdFinding),
  // 8장 5번: suggestions는 findings[] 안으로 정리하자는 제안이라 여기서는 비워 둔다
  suggestions: z.array(z.string()),
  reviewer_id: Id.nullable(),
  review_status: ReviewStatus,
  reviewer_note: z.string().nullable(),
  // 제안: 8장 2·3·4·17·18번
  final_text: z.string().optional(),
  product_category: ProductCategory.optional(),
  usage: AdUsage.optional(),
  translated_text: z.string().optional(),
  back_translation_ko: z.string().optional(),
  overall_risk: Risk.optional(),
  localized_note: z.string().optional(),
  reviewed_at: Timestamp.optional(),
  product_id: Id.optional(),
  promo_event_id: Id.optional(),
});
export type AdCheck = z.infer<typeof AdCheck>;
