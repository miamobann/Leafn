import type { z } from "zod";
import { callAi, type AiReply, type AiRequest, type AiUsage } from "@/lib/ai/client";
import type { AdUsage } from "@/lib/schemas/ad-check";
import type { AdCheckProductInput, JudgedLine } from "@/lib/schemas/ad-check-ai";
import { MAX_LINES } from "./action";
import { parseModelOutput } from "./parse";
import { buildSystemPrompt, buildUserMessage } from "./prompt";

/** 지금 쓰는 프롬프트 버전 (prompts/ad-check.<버전>.md). 저장하는 prompt_version 은 "ad-check.<버전>" */
export const AD_CHECK_PROMPT_VERSION = "v5";

/** AI 응답이 두 번 모두 약속한 모양이 아닐 때. message 는 화면에 보여 줘도 안전하다 (모델 출력 원문은 cause 에만 있다) */
export class AdCheckParseError extends Error {
  constructor(cause: unknown) {
    super("AI 응답 형식이 맞지 않아 판정하지 못했습니다", { cause });
  }
}

export type JudgeInput = {
  product: AdCheckProductInput;
  usage: z.infer<typeof AdUsage>;
  /** 입력 줄 (1~MAX_LINES줄). splitInputLines 로 만든다 */
  lines: string[];
};

export type JudgeResult = {
  /** 입력한 줄 순서 그대로 */
  lines: JudgedLine[];
  /** 재시도까지 합친 토큰 */
  usage: AiUsage;
  /** 실제로 부른 모델 ID */
  model: string;
  promptVersion: string;
  attempts: number;
  warnings: string[];
};

const MAX_ATTEMPTS = 2; // 검증 실패 시 1회 재시도 (CLAUDE.md 7장 1번)

type Deps = { /** 시험에서 가짜 호출을 끼울 때만 쓴다 */ call?: (request: AiRequest) => Promise<AiReply> };

/** 여러 줄을 한 요청으로 판정한다 (정밀 등급). 호출·설정 오류는 그대로 던지고, 응답 모양 오류만 재시도한다 */
export async function judgeLines(input: JudgeInput, deps: Deps = {}): Promise<JudgeResult> {
  if (input.lines.length < 1 || input.lines.length > MAX_LINES) throw new Error(`한 요청은 1~${MAX_LINES}줄: ${input.lines.length}줄`);
  const call = deps.call ?? callAi;
  const system = buildSystemPrompt(AD_CHECK_PROMPT_VERSION);
  const user = buildUserMessage(input.product, input.usage, input.lines);

  const total: AiUsage = { input: 0, cached: 0, output: 0 };
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const reply = await call({ grade: "precise", system, user });
    total.input += reply.usage.input;
    total.cached += reply.usage.cached;
    total.output += reply.usage.output;
    try {
      const parsed = parseModelOutput(reply.text, input.lines);
      return { lines: parsed.lines, usage: total, model: reply.model, promptVersion: AD_CHECK_PROMPT_VERSION, attempts: attempt, warnings: parsed.warnings };
    } catch (e) {
      lastError = e;
    }
  }
  throw new AdCheckParseError(lastError);
}
