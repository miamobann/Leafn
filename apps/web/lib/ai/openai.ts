// OpenAI 클라이언트와 모델 설정 (서버 전용. OPENAI_API_KEY는 NEXT_PUBLIC_ 없이 서버에서만 읽는다)
// 모델 ID는 여기 한곳에서 관리한다 (CLAUDE.md 2장)
import OpenAI from "openai";

export const AI_MODELS = {
  /** 상품 이미지 읽기 (소구 성분·프로모션 추출) */
  vision: process.env.OPENAI_VISION_MODEL ?? "gpt-4o",
};

export class AiConfigError extends Error {}

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new AiConfigError("OPENAI_API_KEY가 설정되지 않았어요. apps/web/.env.local에 추가한 뒤 개발 서버를 다시 켜 주세요.");
  }
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}
