import { z } from "zod";
import { Timestamp, WorkspaceRow } from "./common";

// (참조 G) 문항 설정. 분류 기준은 열린 질문 (CLAUDE.md 11장)
export const SurveyQuestion = z.object({
  id: z.string(),
  text_ja: z.string(),
  options: z.array(z.object({ value: z.string(), label_ja: z.string() })),
});
export type SurveyQuestion = z.infer<typeof SurveyQuestion>;

export const SkinSurveyResponse = WorkspaceRow.extend({
  answers: z.record(z.string(), z.string()),
  skin_type: z.string(),
  consent_at: Timestamp,
  locale: z.string(),
});
export type SkinSurveyResponse = z.infer<typeof SkinSurveyResponse>;

/** 대시보드 응답 집계 (가짜 데이터에서는 응답 원본 대신 집계만 둔다) */
export const SurveySummary = z.object({
  total: z.number().int().nonnegative(),
  by_skin_type: z.array(z.object({ skin_type: z.string(), count: z.number().int().nonnegative() })),
});
export type SurveySummary = z.infer<typeof SurveySummary>;
