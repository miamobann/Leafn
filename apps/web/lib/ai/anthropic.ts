// Anthropic 클라이언트 (서버 전용. ANTHROPIC_API_KEY는 NEXT_PUBLIC_ 없이 서버에서만 읽는다)
import Anthropic from "@anthropic-ai/sdk";
import { AiConfigError } from "./openai";

let client: Anthropic | null = null;

export function hasAnthropicKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AiConfigError("ANTHROPIC_API_KEY가 설정되지 않았어요. apps/web/.env.local에 추가한 뒤 개발 서버를 다시 켜 주세요.");
  }
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}
