import { z } from "zod";
import { AdAction, AdFinding, BasisStatus, SuggestionRecheck } from "./ad-check";
import { Risk } from "./common";

// 광고 검토 AI가 내는 JSON의 모양 (prompts/ad-check.v4.md 9장). 검증에 통과해야 화면·DB 모양(AdFinding 등)으로 바뀐다.
// ok 줄은 line_index, action, 번역, 역번역, findings(빈 배열)만 낸다. 그 밖의 칸은 코드가 채운다.

export const AiSuggestion = z.object({
  text: z.string(),
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
