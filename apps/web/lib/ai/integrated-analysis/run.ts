// 통합 AI 분석 실행 (정밀 등급, docs/team-approval-ai-analysis.md 7장 4단계 · 10장).
// 호출 · 설정 오류는 그대로 던지고, 응답 모양 오류만 1회 재시도한다 (리뷰 분석 analyze.ts와 같은 방식).
import { callAi, type AiReply, type AiRequest, type AiUsage } from "@/lib/ai/client";
import { AiAnalysisOutput, type AiAnalysisResult } from "@/lib/schemas/ai-analysis";
import { PROMPT_VERSION } from "./config";
import { IntegratedAnalysisParseError, parseIntegratedAnalysis } from "./parse";
import { buildSystemPrompt, buildUserMessage, computeFacts, type IntegratedInput } from "./prompt";

const MAX_ATTEMPTS = 2;

export type IntegratedAnalysisRun = {
  result: AiAnalysisResult;
  usage: AiUsage;
  /** 실제로 부른 모델 ID */
  model: string;
  promptVersion: string;
  attempts: number;
};

type Deps = { /** 시험에서 가짜 호출을 끼울 때만 쓴다 */ call?: (request: AiRequest) => Promise<AiReply> };

export async function runIntegratedAnalysis(input: IntegratedInput, deps: Deps = {}): Promise<IntegratedAnalysisRun> {
  if (input.versions.length === 0) throw new Error("승인본을 하나 이상 골라 주세요");
  const call = deps.call ?? callAi;
  const system = await buildSystemPrompt(PROMPT_VERSION);
  const facts = computeFacts(input.versions, input);
  const user = buildUserMessage(input, facts);
  const refs = new Map(input.versions.map((v) => [v.ref, v.id]));
  const extras = { events: input.calendar ?? [], survey: input.survey ?? null };

  const usage: AiUsage = { input: 0, cached: 0, output: 0 };
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const reply = await call({ grade: "precise", system: system.text, user, schema: { name: "integrated_analysis", zod: AiAnalysisOutput } });
    usage.input += reply.usage.input;
    usage.cached += reply.usage.cached;
    usage.output += reply.usage.output;
    try {
      const result = parseIntegratedAnalysis(reply.text, system.perspectives, refs, facts, extras);
      return { result, usage, model: reply.model, promptVersion: system.version, attempts: attempt };
    } catch (e) {
      if (!(e instanceof IntegratedAnalysisParseError)) throw e;
      lastError = e;
    }
  }
  throw lastError;
}
