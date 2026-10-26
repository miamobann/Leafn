"use server";

// SNS 분석 결과 JSON 올리기 (Server Action, 지침서 2번 · 2026-10-26). PC에서 따로 돌린 분석 결과를 같은 테이블(sns_trend_analyses)에 저장한다.
// 모양은 lib/schemas/market.ts SnsTrendResult와 같아야 한다 (화면의 [분석 시작] 결과를 그대로 내려받은 JSON)
import { SnsResultUpload, type SnsTrendResult } from "@/lib/schemas/market";
import { createClient } from "@/lib/supabase/server";
import { insertSnsAnalysis } from "./sns-analyses";
import { getMyWorkspace, isSupabaseConfigured } from "./workspace";

export type SnsUploadResult = { ok: true; result: SnsTrendResult } | { ok: false; message: string };

export async function saveSnsAnalysisJson(raw: unknown): Promise<SnsUploadResult> {
  const parsed = SnsResultUpload.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "분석 결과 JSON 모양이 맞지 않아요 (category · videos · needs · keywords · model · prompt_version · analyzed_at)" };
  const result = parsed.data;
  // 니즈·키워드가 가리키는 영상 번호는 영상 목록 안에 있어야 한다
  const count = result.videos.length;
  const refs = [...result.needs.flatMap((n) => [...n.videos, ...n.evidence.map((e) => e.video)]), ...result.keywords.flatMap((k) => k.videos)];
  if (refs.some((v) => v < 1 || v > count)) return { ok: false, message: "영상 목록에 없는 영상 번호가 있어요" };

  if (!isSupabaseConfigured()) return { ok: true, result: { ...result, saved: false, save_error: "샘플 모드라 저장하지 않았어요" } };
  const mine = await getMyWorkspace();
  if (!mine) return { ok: false, message: "먼저 로그인하고 워크스페이스를 만들어 주세요." };
  const save = await insertSnsAnalysis(await createClient(), mine.workspace.id, result);
  return { ok: true, result: { ...result, ...save } };
}
