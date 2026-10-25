// 리뷰 묶음 분석 (대량 등급). 호출·설정 오류는 그대로 던지고, 응답 모양 오류만 1회 재시도한다.
import { callAi, type AiReply, type AiRequest, type AiUsage } from "@/lib/ai/client";
import type { Lang } from "@/lib/schemas/common";
import { AiReviewBatch } from "@/lib/schemas/review-analysis-ai";
import { parseReviewAnalysis, type ParsedReview, ReviewAnalysisParseError } from "./parse";
import { buildSystemPrompt, buildUserMessage } from "./prompt";

/** 지금 쓰는 프롬프트 버전 (prompts/review-analysis.v<N>.md). 저장하는 prompt_version 은 "review-analysis.v<N>" */
export const REVIEW_ANALYSIS_PROMPT_VERSION = 1;

/** 한 번에 분석하는 리뷰 수 (CLAUDE.md 0장: 기본 50건) */
export const BATCH_SIZE = 50;

const MAX_ATTEMPTS = 2;

export type AnalyzeInput = { lang: Lang; category: string | null; reviews: { body: string }[] };

export type AnalyzeResult = {
  /** 입력한 순서 그대로 */
  items: ParsedReview[];
  usage: AiUsage;
  /** 실제로 부른 모델 ID */
  model: string;
  promptVersion: string;
  attempts: number;
};

type Deps = { /** 시험에서 가짜 호출을 끼울 때만 쓴다 */ call?: (request: AiRequest) => Promise<AiReply> };

export async function analyzeReviews(input: AnalyzeInput, deps: Deps = {}): Promise<AnalyzeResult> {
  if (input.reviews.length < 1 || input.reviews.length > BATCH_SIZE) throw new Error(`한 번에 1~${BATCH_SIZE}건: ${input.reviews.length}건`);
  const call = deps.call ?? callAi;
  const system = await buildSystemPrompt(REVIEW_ANALYSIS_PROMPT_VERSION);
  const user = buildUserMessage(input);

  const usage: AiUsage = { input: 0, cached: 0, output: 0 };
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const reply = await call({ grade: "bulk", system: system.text, user, schema: { name: "review_analysis", zod: AiReviewBatch } });
    usage.input += reply.usage.input;
    usage.cached += reply.usage.cached;
    usage.output += reply.usage.output;
    try {
      const items = parseReviewAnalysis(reply.text, input.reviews.length);
      return { items, usage, model: reply.model, promptVersion: system.version, attempts: attempt };
    } catch (e) {
      if (!(e instanceof ReviewAnalysisParseError)) throw e;
      lastError = e;
    }
  }
  throw lastError;
}
