import { z } from "zod";
import { AdAction, AdFinding, AdUsage, BasisStatus, ProductCategory, SuggestionRecheck } from "./ad-check";
import { Id, Risk } from "./common";

// 광고 검토 AI가 내는 JSON의 모양 (prompts/ad-check.v4.md 9장). 검증에 통과해야 화면·DB 모양(AdFinding 등)으로 바뀐다.
// ok 줄은 line_index, action, 번역, 역번역, findings(빈 배열)만 낸다. 그 밖의 칸은 코드가 채운다.

// 판정에 필요한 제품 정보만 받는다. products 테이블 행을 그대로 받지 않아서, 제품 구분처럼 아직 DB에 없는 값도 따로 넘길 수 있다.
export const AdCheckProductInput = z.object({
  name: z.string().min(1),
  product_category: ProductCategory.nullable(), // 일반 화장품 / 의약부외품. 미정이면 null
  ingredients: z.array(z.string().min(1)).min(1), // 전성분 표시명. 한국어(일본어) 병기도 문자열 그대로 넘기면 된다
});
export type AdCheckProductInput = z.infer<typeof AdCheckProductInput>;

/** POST /api/ad-check 요청 본문. 저장 단계에서 서버가 로그인 정보로 workspace_id 를 정한다 */
export const AD_CHECK_MAX_TEXT_CHARS = 4000;
export const AdCheckRequest = z.object({
  workspace_id: Id,
  product_id: Id.optional(),
  product: AdCheckProductInput,
  usage: AdUsage,
  text: z.string().min(1).max(AD_CHECK_MAX_TEXT_CHARS), // 한 줄 = 한 문구
  /** 만든 가이드의 「이 문구로 새 검토」에서 왔으면 그 가이드 (ad_checks.content_guide_id) */
  content_guide_id: Id.optional(),
});
export type AdCheckRequest = z.infer<typeof AdCheckRequest>;

export const AiSuggestion = z.object({
  text: z.string(), // 일본어 (프롬프트 v5)
  text_ko: z.string().nullable().optional(),
  recheck: SuggestionRecheck.shape.recheck,
  recheck_reason: z.string(),
});

export const AiFinding = z.object({
  text: z.string().min(1),
  risk: Risk.optional(), // 없으면 행동 기준에서 정한다
  action: AdAction.exclude(["ok"]),
  reason: z.string(),
  basis: z.string(),
  basis_status: BasisStatus,
  suggestions: z.array(AiSuggestion),
});

export const AiLine = z.object({
  line_index: z.number().int().positive(),
  action: AdAction,
  ingredient_check: z.string().optional(),
  translated_text: z.string().nullable().optional(),
  back_translation_ko: z.string().nullable().optional(),
  localized_note: z.string().optional(),
  findings: z.array(AiFinding),
});
export type AiLine = z.infer<typeof AiLine>;

export const AiResult = z.object({
  overall_action: AdAction,
  overall_risk: Risk,
  lines: z.array(AiLine),
});

/** 줄 하나의 판정. AdLineResult·AdFinding 모양으로 바꾼 것이고, line_index 와 원문은 코드가 붙인다 */
export const JudgedLine = z.object({
  action: AdAction,
  ingredient_check: z.string(),
  translated_text: z.string().nullable(),
  back_translation_ko: z.string().nullable(),
  localized_note: z.string(),
  findings: z.array(AdFinding.omit({ line_index: true })),
});
export type JudgedLine = z.infer<typeof JudgedLine>;
