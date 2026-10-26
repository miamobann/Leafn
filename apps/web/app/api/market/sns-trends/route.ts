// POST /api/market/sns-trends — 영상 링크만 받아 Apify로 영상 정보를 가져오고, AI가 핵심 키워드·트렌드를 뽑는다 (시장 분석 · 소비자 트렌드)
// 입력: { category, videos: [{ url, memo? }] } (2~10개) · Apify 1회(최대 $0.50) + AI 1회
// 저장: sns_trend_analyses (지침서 2번, 2026-10-26). 테이블 적용 전이거나 샘플 모드면 저장하지 않고 결과만 돌려준다 (saved · save_error)
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { AiConfigError } from "@/lib/ai/config";
import { analyzeSnsTrends } from "@/lib/ai/sns/trends";
import { ApifyConfigError } from "@/lib/external/apify-tiktok";
import { insertSnsAnalysis } from "@/lib/data/sns-analyses";
import { getCurrentUser, getMyWorkspace, isSupabaseConfigured } from "@/lib/data/workspace";
import { createClient } from "@/lib/supabase/server";
import { SnsTrendInput } from "@/lib/schemas/market";

// Apify 실행(최대 100초) + AI 호출
export const maxDuration = 150;

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
  const input = SnsTrendInput.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return NextResponse.json({ error: input.error.issues[0]?.message ?? "입력 형식이 올바르지 않아요" }, { status: 400 });
  }
  try {
    const result = await analyzeSnsTrends(input.data);
    if (!isSupabaseConfigured()) return NextResponse.json({ ...result, saved: false, save_error: "샘플 모드라 저장하지 않았어요" });
    const mine = await getMyWorkspace();
    if (!mine) return NextResponse.json({ ...result, saved: false, save_error: "워크스페이스가 없어 저장하지 않았어요" });
    // 영상 번호(index)는 입력 순서라 그 순서의 메모를 같이 남긴다
    const memos = Object.fromEntries(result.videos.map((v) => [v.url, input.data.videos[v.index - 1]?.memo ?? ""]));
    const save = await insertSnsAnalysis(await createClient(), mine.workspace.id, result, memos);
    return NextResponse.json({ ...result, ...save });
  } catch (e) {
    const config = e instanceof AiConfigError || e instanceof ApifyConfigError || e instanceof OpenAI.AuthenticationError || e instanceof Anthropic.AuthenticationError;
    return NextResponse.json({ error: errorMessage(e) }, { status: config ? 503 : 500 });
  }
}
