// 일본어 리뷰 → 한국어 번역 (대량 등급). 응답 모양 오류만 1회 재시도하고, 호출·설정 오류는 그대로 던진다.
// 프롬프트 원문은 prompts/review-translate-ko.v<N>.md 에만 있다 (CLAUDE.md 7장).
import { callAi, type AiReply, type AiRequest, type AiUsage } from "@/lib/ai/client";
import { loadPrompt } from "@/lib/ai/prompts";
import { AiTranslationBatch } from "@/lib/schemas/review-analysis-ai";
import { BATCH_SIZE } from "./analyze";
import { ReviewAnalysisParseError } from "./parse";
import { MAX_BODY_CHARS } from "./prompt";

export const REVIEW_TRANSLATE_PROMPT_VERSION = 1;

const MAX_ATTEMPTS = 2;

export type TranslateResult = {
  /** 입력한 순서 그대로 */
  texts: string[];
  usage: AiUsage;
  /** 실제로 부른 모델 ID */
  model: string;
  promptVersion: string;
  attempts: number;
};

type Deps = { /** 시험에서 가짜 호출을 끼울 때만 쓴다 */ call?: (request: AiRequest) => Promise<AiReply> };

async function buildSystemPrompt(version: number) {
  const { text, version: id } = await loadPrompt("review-translate-ko", version);
  const body = text.split(/^---\s*$/m).slice(1).join("---").trim();
  if (!body.includes("#번역 규칙") || !body.includes("#출력 형식")) throw new Error(`프롬프트 형식이 맞지 않습니다: ${id}`);
  return { text: body, version: id };
}

export function buildTranslateMessage(bodies: string[]): string {
  const lines = bodies.map((b, i) => `[${i + 1}] ${b.replace(/\s+/g, " ").trim().slice(0, MAX_BODY_CHARS)}`);
  return ["#입력", "언어: 일본어(ja) → 한국어", `리뷰 ${bodies.length}건`, "'''", ...lines, "'''", `위 리뷰 ${bodies.length}건을 번호 1부터 ${bodies.length}까지 빠짐없이 번역하세요.`].join("\n");
}

/** 응답을 검증해 입력 순서대로의 번역문 배열로 돌려준다 (순수 함수) */
export function parseTranslation(text: string, expectedCount: number): string[] {
  let json: unknown;
  try {
    json = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  } catch (e) {
    throw new ReviewAnalysisParseError("JSON 아님", e);
  }
  const parsed = AiTranslationBatch.safeParse(json);
  if (!parsed.success) throw new ReviewAnalysisParseError("필드 오류", parsed.error);
  const byNumber = new Map<number, string>();
  for (const r of parsed.data.results) {
    if (r.n < 1 || r.n > expectedCount) throw new ReviewAnalysisParseError(`번호 범위 밖: ${r.n}`);
    if (byNumber.has(r.n)) throw new ReviewAnalysisParseError(`번호 중복: ${r.n}`);
    if (!r.text_ko.trim()) throw new ReviewAnalysisParseError(`빈 번역: ${r.n}`);
    byNumber.set(r.n, r.text_ko.trim());
  }
  if (byNumber.size !== expectedCount) throw new ReviewAnalysisParseError(`건수 불일치: ${byNumber.size}/${expectedCount}`);
  return Array.from({ length: expectedCount }, (_, i) => byNumber.get(i + 1)!);
}

export async function translateReviewsToKorean(input: { bodies: string[] }, deps: Deps = {}): Promise<TranslateResult> {
  if (input.bodies.length < 1 || input.bodies.length > BATCH_SIZE) throw new Error(`한 번에 1~${BATCH_SIZE}건: ${input.bodies.length}건`);
  const call = deps.call ?? callAi;
  const system = await buildSystemPrompt(REVIEW_TRANSLATE_PROMPT_VERSION);
  const user = buildTranslateMessage(input.bodies);

  const usage: AiUsage = { input: 0, cached: 0, output: 0 };
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const reply = await call({ grade: "bulk", system: system.text, user, schema: { name: "review_translation", zod: AiTranslationBatch } });
    usage.input += reply.usage.input;
    usage.cached += reply.usage.cached;
    usage.output += reply.usage.output;
    try {
      return { texts: parseTranslation(reply.text, input.bodies.length), usage, model: reply.model, promptVersion: system.version, attempts: attempt };
    } catch (e) {
      if (!(e instanceof ReviewAnalysisParseError)) throw e;
      lastError = e;
    }
  }
  throw lastError;
}
