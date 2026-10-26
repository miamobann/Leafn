// SNS 영상 분석 결과 저장 (서버 전용 함수, 서버 데이터 연동 작업 지침서 2번 · 2026-10-26).
// /api/market/sns-trends(분석 직후)와 결과 JSON 올리기(sns-analysis-actions.ts)가 같이 쓴다.
// 로그인한 사용자의 세션으로 쓰므로 RLS가 워크스페이스를 가른다. 테이블 적용 전이면 저장하지 않고 이유만 돌려준다
import type { createClient } from "@/lib/supabase/server";
import type { SnsTrendResult } from "@/lib/schemas/market";

export type SnsSaveResult = { saved: boolean; save_error: string | null };

export async function insertSnsAnalysis(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  result: Omit<SnsTrendResult, "saved" | "save_error">,
  memos: Record<string, string> = {},
): Promise<SnsSaveResult> {
  const { error } = await supabase.from("sns_trend_analyses").insert({
    workspace_id: workspaceId,
    category: result.category,
    videos: result.videos.map((v) => ({ ...v, memo: memos[v.url] ?? "" })),
    result: { needs: result.needs, keywords: result.keywords, dropped: result.dropped, analyzed_at: result.analyzed_at },
    model: result.model,
    prompt_version: result.prompt_version,
  });
  if (!error) return { saved: true, save_error: null };
  if (error.code === "PGRST205" || error.code === "42P01") return { saved: false, save_error: "저장 테이블(sns_trend_analyses) 적용 전이에요" };
  return { saved: false, save_error: error.message };
}
