// POST /api/market/sns-patterns — 마케터가 고른 영상 링크·메모에서 공통 패턴을 뽑는다 (시장 분석 · 소비자 트렌드)
// 입력: { category, videos: [{ url, memo }] } (3~10개) · 결과는 저장하지 않고 화면에 바로 보여준다 (DB 테이블은 합의 후)
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { AiConfigError } from "@/lib/ai/config";
import { analyzeSnsPatterns } from "@/lib/ai/sns/patterns";
import { getCurrentUser, isSupabaseConfigured } from "@/lib/data/workspace";
import { SnsAnalyzeInput } from "@/lib/schemas/market";

export const maxDuration = 60;

function errorMessage(e: unknown): string {
  if (e instanceof OpenAI.RateLimitError || e instanceof Anthropic.RateLimitError) return "호출 한도에 걸렸어요. 잠시 뒤 다시 시도해 주세요.";
  if (e instanceof OpenAI.AuthenticationError) return "OPENAI_API_KEY가 올바르지 않아요.";
  if (e instanceof Anthropic.AuthenticationError) return "ANTHROPIC_API_KEY가 올바르지 않아요.";
  if (e instanceof OpenAI.APIError || e instanceof Anthropic.APIError) return `API 오류 (${e.status}): ${e.message}`;
  return e instanceof Error ? e.message : "알 수 없는 오류";
}

export async function POST(request: Request) {
  if (isSupabaseConfigured() && !(await getCurrentUser())) {
    return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });
  }
  const input = SnsAnalyzeInput.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return NextResponse.json({ error: input.error.issues[0]?.message ?? "입력 형식이 올바르지 않아요" }, { status: 400 });
  }
  try {
    return NextResponse.json(await analyzeSnsPatterns(input.data));
  } catch (e) {
    const status = e instanceof AiConfigError || e instanceof OpenAI.AuthenticationError || e instanceof Anthropic.AuthenticationError ? 503 : 500;
    return NextResponse.json({ error: errorMessage(e) }, { status });
  }
}
