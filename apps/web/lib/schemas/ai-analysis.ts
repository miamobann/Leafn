import { z } from "zod";
import { AiMeta, Id, Timestamp, WorkspaceRow } from "./common";
import { SubmissionTab } from "./submission";

// 탭별 승인본을 모아 돌린 통합 AI 분석 (docs/team-approval-ai-analysis.md 3장 5~6, 10장).
// 테이블: supabase/migrations/20261025115007_team_approval.sql (ai_analyses)
// 결과의 관점(sections[].key)은 프롬프트 prompts/integrated-analysis.v*.md의 #분석 관점에서 오므로 여기서는 이름을 정하지 않는다.

/** 판단의 확신도 (프롬프트 v2 #판단 단계 2단계: high = 서로 다른 탭 2개 이상이 같은 방향) */
export const AiConfidence = z.enum(["high", "medium", "low"]);
export type AiConfidence = z.infer<typeof AiConfidence>;

/** 종합 판단: 지금 진행 / 보완 후 진행 / 보류 (프롬프트 v2 #판단 단계 4단계) */
export const AiVerdictLevel = z.enum(["go", "fix_first", "hold"]);
export type AiVerdictLevel = z.infer<typeof AiVerdictLevel>;

/** 판단 한 문장. basis는 저장할 때 AI가 쓴 ref(예: review@v2)를 입력 버전 ID로 바꾼 값이다 */
export const AiAnalysisPoint = z.object({
  text: z.string().min(1),
  basis: z.array(Id),
  /** 입력에 없는 ref를 인용해서 근거를 사람이 확인해야 하는 문장 (설계 10장 "근거 확인 필요") */
  needs_check: z.boolean().optional(),
});
export type AiAnalysisPoint = z.infer<typeof AiAnalysisPoint>;

/** 빠진 근거. v1 결과는 문자열, v2부터는 어느 탭의 근거가 빠졌는지 함께 남긴다 */
export const AiDataGap = z.union([z.string(), z.object({ text: z.string().min(1), tab: SubmissionTab })]);
export type AiDataGap = z.infer<typeof AiDataGap>;

// 저장 모양. v2에서 늘어난 칸(confidence · agreements · check_first · verdict · counterpoint · done_when)은
// v1 결과 행에는 없으므로 선택 칸으로 둔다
export const AiAnalysisResult = z.object({
  summary: z.string(),
  sections: z.array(
    z.object({
      key: z.string().min(1),
      title: z.string().min(1),
      points: z.array(AiAnalysisPoint.extend({ confidence: AiConfidence.optional() })),
    }),
  ),
  agreements: z.array(AiAnalysisPoint).optional(),
  conflicts: z.array(AiAnalysisPoint.extend({ check_first: SubmissionTab.optional() })),
  data_gaps: z.array(AiDataGap),
  verdict: z
    .object({
      level: AiVerdictLevel,
      reason: z.string(),
      basis: z.array(Id),
      needs_check: z.boolean().optional(),
      /** AI가 고른 값이 프롬프트 규칙(미해결 광고 위험 · 승인 탭 2개 미만이면 go 금지)을 어겨서 코드가 낮춘 경우의 원래 값 */
      adjusted_from: AiVerdictLevel.optional(),
    })
    .optional(),
  /** 종합 판단에 대한 가장 강한 반대 근거. 입력에 반대 근거가 없으면 basis가 비어 있다 */
  counterpoint: AiAnalysisPoint.optional(),
  actions: z.array(
    AiAnalysisPoint.extend({
      tab: SubmissionTab,
      /** 1이 가장 급하다 */
      priority: z.number().int().min(1),
      /** 끝났다고 볼 기준 (v2부터) */
      done_when: z.string().optional(),
    }),
  ),
});
export type AiAnalysisResult = z.infer<typeof AiAnalysisResult>;

const OutputPoint = z.object({ text: z.string(), basis: z.array(z.string()) });

/**
 * AI 응답 그대로의 모양 (프롬프트 #출력 형식). basis는 입력의 ref(예: review@v2)다.
 * 구조화 출력에 쓰므로 선택 칸 · 숫자 범위를 두지 않고, 범위 확인과 ref → 버전 ID 바꾸기는 lib/ai/integrated-analysis/parse.ts가 한다.
 * 칸 순서가 곧 모델이 쓰는 순서다: 근거(sections …)를 먼저, 결론(summary)을 맨 끝에 둔다
 */
export const AiAnalysisOutput = z.object({
  sections: z.array(
    z.object({
      key: z.string(),
      title: z.string(),
      points: z.array(OutputPoint.extend({ confidence: AiConfidence })),
    }),
  ),
  agreements: z.array(OutputPoint),
  conflicts: z.array(OutputPoint.extend({ check_first: SubmissionTab })),
  data_gaps: z.array(z.object({ text: z.string(), tab: SubmissionTab })),
  verdict: z.object({ level: AiVerdictLevel, reason: z.string(), basis: z.array(z.string()) }),
  counterpoint: OutputPoint,
  actions: z.array(OutputPoint.extend({ tab: SubmissionTab, priority: z.number().int(), done_when: z.string() })),
  summary: z.string(),
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
