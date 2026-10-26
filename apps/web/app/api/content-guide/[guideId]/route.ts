// DELETE /api/content-guide/[guideId]: 만든 가이드 삭제 (행 삭제). 연결된 약기법 검사 기록(ad_checks)은 남는다 (docs/tab3-db-plan.md). owner만.
//   ?all=1 이면 그 콘텐츠 가이드의 모든 버전을 지우고, 그 가이드에서 나온 문구 검토는 숨긴다 (검토 기록 목록의 삭제, 2026-10-27).
// PATCH /api/content-guide/[guideId]: 블록별 메모 저장 (멤버 누구나, DB 함수 set_content_guide_memos 로 memos 칸만 바꾼다).
import { NextResponse } from "next/server";
import { z } from "zod";
import { loadContentRecord } from "@/app/(internal)/(dashboard)/ad-check/_lib/records";
import { getMyWorkspace, isSupabaseConfigured } from "@/lib/data/workspace";
import { createClient } from "@/lib/supabase/server";

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

const Memos = z.object({ memos: z.record(z.string().max(100), z.string().max(2000)) });

export async function PATCH(request: Request, { params }: { params: Promise<{ guideId: string }> }) {
  if (!isSupabaseConfigured()) return fail(409, "DB가 연결되지 않아 메모를 저장할 수 없습니다.");
  const mine = await getMyWorkspace();
  if (!mine) return fail(401, "로그인이 필요합니다");
  const { guideId } = await params;
  if (!z.uuid().safeParse(guideId).success) return fail(400, "가이드 번호가 올바르지 않습니다.");
  const parsed = Memos.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, "메모가 올바르지 않습니다.");
  // 빈 메모는 저장하지 않는다
  const memos = Object.fromEntries(Object.entries(parsed.data.memos).filter(([, v]) => v.trim()));
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_content_guide_memos", { p_guide_id: guideId, p_memos: memos });
  if (error) return fail(500, "메모를 저장하지 못했습니다.");
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ guideId: string }> }) {
  if (!isSupabaseConfigured()) return fail(409, "DB가 연결되지 않아 삭제할 수 없습니다.");
  const mine = await getMyWorkspace();
  if (!mine) return fail(401, "로그인이 필요합니다");
  if (mine.role !== "owner") return fail(403, "삭제는 워크스페이스 관리자(owner)만 할 수 있습니다");

  const { guideId } = await params;
  if (!z.uuid().safeParse(guideId).success) return fail(400, "가이드 번호가 올바르지 않습니다.");
  const supabase = await createClient();
  if (new URL(request.url).searchParams.get("all") === "1") {
    const record = await loadContentRecord(guideId);
    if (!record || record.latest.workspace_id !== mine.workspace.id) return fail(404, "가이드를 찾을 수 없습니다.");
    const versionIds = record.versions.map((v) => v.id);
    const phraseIds = record.phrases.map((p) => p.check.id);
    // 1) 문구 검토는 숨김 (약기법 검토는 증거로 행을 남긴다) 2) 콘텐츠 가이드는 모든 버전 행 삭제
    if (phraseIds.length) {
      const { error: hideErr } = await supabase.from("ad_checks").update({ deleted_at: new Date().toISOString() }).in("id", phraseIds).eq("workspace_id", mine.workspace.id);
      if (hideErr) return fail(500, "문구 검토를 숨기지 못했습니다.");
    }
    const { error: delErr } = await supabase.from("content_guides").delete().in("id", versionIds).eq("workspace_id", mine.workspace.id);
    if (delErr) return fail(500, "가이드를 삭제하지 못했습니다.");
    return NextResponse.json({ ok: true, deleted: versionIds.length, hidden: phraseIds.length });
  }
  const { data, error } = await supabase
    .from("content_guides")
    .delete()
    .eq("id", guideId)
    .eq("workspace_id", mine.workspace.id)
    .select("id").maybeSingle();

  if (error) return fail(500, "가이드를 삭제하지 못했습니다.");
  if (!data) return fail(404, "가이드를 찾을 수 없습니다.");
  return NextResponse.json({ ok: true });
}
