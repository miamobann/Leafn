import { z } from "zod";
import { AiMeta, Id, Lang, ReviewStatus, Risk, Timestamp, WorkspaceRow } from "./common";

// TAB 3 담당자 안 (docs/db-frame.md 2장 ad_checks). 기존 칸은 바꾸지 않고 새 칸만 더했다 (DB_RULES 2장)
// 행동 기준 4단계: 위험도(risk) 대신 "무엇을 해야 하는지"
export const AdAction = z.enum(["must_fix", "should_fix", "expert", "ok"]);
export type AdAction = z.infer<typeof AdAction>;

export const BasisStatus = z.enum(["confirmed", "needs_check"]);

// 대체 표현도 같은 기준으로 다시 검토한 결과
export const SuggestionRecheck = z.object({
  text: z.string(),
  recheck: z.enum(["pass", "needs_rework"]),
  recheck_reason: z.string(),
});
export type SuggestionRecheck = z.infer<typeof SuggestionRecheck>;

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
  // TAB 3 안: 여러 줄 입력에서 몇 번째 줄인지 (1부터)
  line_index: z.number().int().positive().nullable(),
  action: AdAction.nullable(),
  // 근거가 knowledge/yakkiho/ 자료로 확인됐는지
  basis_status: BasisStatus.nullable(),
  suggestion_rechecks: z.array(SuggestionRecheck).nullable(),
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
export const AdUsage = z.enum(["detail_page", "sns", "banner", "survey_result", "notify_button"]);

// 줄별 판정 (jsonb). 성분 확인·번역·현지화는 줄 단위로 나온다
export const AdLineResult = z.object({
  line_index: z.number().int().positive(),
  original: z.string(),
  action: AdAction,
  ingredient_check: z.string(),
  translated_text: z.string().nullable(),
  back_translation_ko: z.string().nullable(),
  localized_note: z.string(),
});
export type AdLineResult = z.infer<typeof AdLineResult>;

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
  // TAB 3 안 (DB 컬럼 후보, null 허용)
  overall_action: AdAction.nullable(),
  line_results: z.array(AdLineResult).nullable(),
  // review_status는 공용 값(pending·approved·rejected) 그대로. approved는 화면에서 "내부 검토 완료"로 표시한다
  is_expert_review_requested: z.boolean().nullable(),
});
export type AdCheck = z.infer<typeof AdCheck>;
