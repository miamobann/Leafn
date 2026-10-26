// DELETE /api/content-guide/[guideId]: 만든 가이드 삭제 (행 삭제). 연결된 약기법 검사 기록(ad_checks)은 남는다 (docs/tab3-db-plan.md). owner만.
// PATCH /api/content-guide/[guideId]: 블록별 메모 저장 (멤버 누구나, DB 함수 set_content_guide_memos 로 memos 칸만 바꾼다).
import { NextResponse } from "next/server";
import { z } from "zod";
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

export async function DELETE(_request: Request, { params }: { params: Promise<{ guideId: string }> }) {
  if (!isSupabaseConfigured()) return fail(409, "DB가 연결되지 않아 삭제할 수 없습니다.");
  const mine = await getMyWorkspace();
  if (!mine) return fail(401, "로그인이 필요합니다");
  if (mine.role !== "owner") return fail(403, "삭제는 워크스페이스 관리자(owner)만 할 수 있습니다");

  const { guideId } = await params;
  if (!z.uuid().safeParse(guideId).success) return fail(400, "가이드 번호가 올바르지 않습니다.");
  const supabase = await createClient();
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
