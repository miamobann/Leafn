import { z } from "zod";
import { AiMeta, Id, Timestamp, WorkspaceRow } from "./common";
import { SubmissionTab } from "./submission";

// 탭별 승인본을 모아 돌린 통합 AI 분석 (docs/team-approval-ai-analysis.md 3장 5~6, 10장).
// 테이블: supabase/migrations/20261025115007_team_approval.sql (ai_analyses)
// 결과의 관점(sections[].key)은 프롬프트 prompts/integrated-analysis.v*.md의 #분석 관점에서 오므로 여기서는 이름을 정하지 않는다.

/** 판단 한 문장. basis는 저장할 때 AI가 쓴 ref(예: review@v2)를 입력 버전 ID로 바꾼 값이다 */
export const AiAnalysisPoint = z.object({
  text: z.string().min(1),
  basis: z.array(Id),
  /** 입력에 없는 ref를 인용해서 근거를 사람이 확인해야 하는 문장 (설계 10장 "근거 확인 필요") */
  needs_check: z.boolean().optional(),
});
export type AiAnalysisPoint = z.infer<typeof AiAnalysisPoint>;

export const AiAnalysisResult = z.object({
  summary: z.string(),
  sections: z.array(
    z.object({
      key: z.string().min(1),
      title: z.string().min(1),
      points: z.array(AiAnalysisPoint),
    }),
  ),
  conflicts: z.array(AiAnalysisPoint),
  data_gaps: z.array(z.string()),
  actions: z.array(
    AiAnalysisPoint.extend({
      tab: SubmissionTab,
      /** 1이 가장 급하다 */
      priority: z.number().int().min(1),
    }),
  ),
});
export type AiAnalysisResult = z.infer<typeof AiAnalysisResult>;

/**
 * AI 응답 그대로의 모양 (프롬프트 #출력 형식). basis는 입력의 ref(예: review@v2)다.
 * 구조화 출력에 쓰므로 선택 칸 · 숫자 범위를 두지 않고, 범위 확인과 ref → 버전 ID 바꾸기는 lib/ai/integrated-analysis/parse.ts가 한다
 */
export const AiAnalysisOutput = z.object({
  summary: z.string(),
  sections: z.array(
    z.object({
      key: z.string(),
      title: z.string(),
      points: z.array(z.object({ text: z.string(), basis: z.array(z.string()) })),
    }),
  ),
  conflicts: z.array(z.object({ text: z.string(), basis: z.array(z.string()) })),
  data_gaps: z.array(z.string()),
  actions: z.array(z.object({ text: z.string(), tab: SubmissionTab, priority: z.number().int(), basis: z.array(z.string()) })),
});
export type AiAnalysisOutput = z.infer<typeof AiAnalysisOutput>;

export const AiAnalysis = WorkspaceRow.merge(AiMeta).extend({
  updated_at: Timestamp,
  project_id: Id,
  product_id: Id.nullable(),
  title: z.string().min(1),
  /** 입력으로 쓴 승인본 (submission_versions.id) */
  input_version_ids: z.array(Id).min(1),
  result: AiAnalysisResult,
  summary: z.string().nullable(),
  created_by: Id.nullable(),
  /** 비어 있으면 "AI 결과 · 팀장 확인 전" (설계 8장 보완 8) */
  lead_checked_by: Id.nullable(),
  lead_checked_at: Timestamp.nullable(),
  deleted_at: Timestamp.nullable(),
});
export type AiAnalysis = z.infer<typeof AiAnalysis>;
