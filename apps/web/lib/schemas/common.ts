import { z } from "zod";

// 공통 컬럼 (CLAUDE.md 5장): id, created_at
export const Id = z.string().min(1);
export const Timestamp = z.string().datetime({ offset: true });
export const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const BaseRow = z.object({
  id: Id,
  created_at: Timestamp,
});

export const WorkspaceRow = BaseRow.extend({
  workspace_id: Id,
});

export const Lang = z.enum(["ko", "ja"]);
export type Lang = z.infer<typeof Lang>;

export const Risk = z.enum(["high", "medium", "low"]);
export type Risk = z.infer<typeof Risk>;

export const Sentiment = z.enum(["positive", "negative", "neutral"]);
export type Sentiment = z.infer<typeof Sentiment>;

export const ReviewStatus = z.enum(["pending", "approved", "rejected"]);
export type ReviewStatus = z.infer<typeof ReviewStatus>;

// AI 결과 행에는 model, prompt_version을 남긴다 (CLAUDE.md 5장 규칙)
export const AiMeta = z.object({
  model: z.string(),
  prompt_version: z.string(),
});

/** 템플릿이 받는 화면 상태 (prototype-plan 4.1) */
export const ViewState = z.enum(["ready", "empty", "loading", "error"]);
export type ViewState = z.infer<typeof ViewState>;
