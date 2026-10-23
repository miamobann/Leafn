// AI 호출의 입구. 화면·Route Handler 는 이 함수 하나만 부르고, 어느 제공사·모델을 쓰는지는 모른다 (CLAUDE.md 2장).
// 키는 환경 변수에서만 읽는다. 오류 메시지와 로그에는 키·요청 내용·제공사 오류 원문을 넣지 않는다.
import OpenAI from "openai";
import { AiConfigError, resolveModel, resolveProvider, type AiGrade, type AiProvider } from "./config";

export type AiRequest = { grade: AiGrade; system: string; user: string };

export type AiUsage = { input: number; cached: number; output: number };

export type AiReply = {
  text: string;
  usage: AiUsage;
  /** 실제로 부른 모델 ID. AI 결과 행의 model 에 그대로 남긴다 (CLAUDE.md 5장) */
  model: string;
  provider: AiProvider;
};

/** 제공사 호출이 실패했을 때. message 는 화면에 보여 줘도 안전하다 (상태 코드만 담는다) */
export class AiCallError extends Error {
  constructor(
    readonly status: number | null,
    readonly code: string | null,
  ) {
    super(status === null ? "AI 호출 실패 (연결 오류)" : `AI 호출 실패 (코드 ${status})`);
  }
}

const TIMEOUT_MS = 60_000;

type Deps = { /** 시험에서 가짜 클라이언트를 끼울 때만 쓴다 */ client?: OpenAI };

function openAiClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AiConfigError("OPENAI_API_KEY 가 설정되어 있지 않습니다");
  return new OpenAI({ apiKey, timeout: TIMEOUT_MS, maxRetries: 1 });
}

export async function callAi(request: AiRequest, deps: Deps = {}): Promise<AiReply> {
  const provider = resolveProvider();
  if (provider !== "openai") throw new AiConfigError(`AI_PROVIDER=${provider} 은 아직 구현되지 않았습니다`);

  const model = resolveModel(provider, request.grade);
  const client = deps.client ?? openAiClient();
  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.user },
      ],
      response_format: { type: "json_object" },
      ...(/^gpt-4/.test(model) ? { temperature: 0 } : {}),
    });
    return {
      text: completion.choices[0]?.message?.content ?? "",
      usage: {
        input: completion.usage?.prompt_tokens ?? 0,
        cached: completion.usage?.prompt_tokens_details?.cached_tokens ?? 0,
        output: completion.usage?.completion_tokens ?? 0,
      },
      model,
      provider,
    };
  } catch (e) {
    if (e instanceof OpenAI.APIError) throw new AiCallError(e.status ?? null, typeof e.code === "string" ? e.code : null);
    throw new AiCallError(null, null);
  }
}
