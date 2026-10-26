"use server";

// 랭킹 수집 CSV 저장 (Server Action, 시장 분석 · 플랫폼 분석의 [랭킹 CSV 올리기]). 로그인한 사용자의 세션으로 쓰므로 RLS가 워크스페이스를 가른다.
// 서버 데이터 연동 작업 지침서 1번 (2026-10-26): 서버 코드는 PC의 CSV를 읽지 않는다. 화면에서 올린 랭킹을 trend_snapshots에 저장해 배포에서도 같은 실데이터를 본다.
// 같은 출처·카테고리·수집 날짜는 한 행 (unique (workspace_id, source, category, captured_at)): 다시 올리면 덮어쓴다
import { RankingImportInput } from "@/lib/schemas/trend";
import { createClient } from "@/lib/supabase/server";
import { getMyWorkspace, isSupabaseConfigured } from "./workspace";

/** 데모는 Qoo10 랭킹만 (CLAUDE.md 1장) */
const SOURCE = "qoo10_ranking";

export type RankingImportResult = { ok: true; data: { count: number; capturedAt: string } } | { ok: false; message: string };

export async function saveRankingCsv(raw: RankingImportInput): Promise<RankingImportResult> {
  if (!isSupabaseConfigured()) return { ok: false, message: "샘플 모드(Supabase 연결 없음)라 저장하지 않아요. 이 PC에서는 lib/mock/samples의 CSV를 그대로 읽어요." };
  const parsed = RankingImportInput.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "저장할 랭킹 형식이 올바르지 않아요" };
  const input = parsed.data;
  const mine = await getMyWorkspace();
  if (!mine) return { ok: false, message: "워크스페이스가 없어요. 먼저 로그인하고 워크스페이스를 만들어 주세요." };

  // 수집 날짜 0시 (일본 시간). 같은 날짜로 다시 올리면 같은 행을 덮어쓴다
  const capturedAt = `${input.captured_date}T00:00:00+09:00`;
  const supabase = await createClient();
  const { error } = await supabase.from("trend_snapshots").upsert(
    {
      workspace_id: mine.workspace.id,
      source: SOURCE,
      category: input.category,
      captured_at: capturedAt,
      data: { ranking: input.ranking, ingredients: [], imported_from: input.file_name },
    },
    { onConflict: "workspace_id,source,category,captured_at" },
  );
  if (error) return { ok: false, message: `랭킹을 저장하지 못했어요: ${error.message}` };
  return { ok: true, data: { count: input.ranking.length, capturedAt } };
}
