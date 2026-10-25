// DELETE /api/content-guide/[guideId]: 만든 콘텐츠 삭제 (행 삭제). 연결된 약기법 검사 기록(ad_checks)은 남는다 (docs/tab3-db-plan.md). owner만.
import { NextResponse } from "next/server";
import { z } from "zod";
import { getMyWorkspace, isSupabaseConfigured } from "@/lib/data/workspace";
import { createClient } from "@/lib/supabase/server";

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ guideId: string }> }) {
  if (!isSupabaseConfigured()) return fail(409, "샘플 모드에서는 삭제할 수 없습니다.");
  const mine = await getMyWorkspace();
  if (!mine) return fail(401, "로그인이 필요합니다");
  if (mine.role !== "owner") return fail(403, "삭제는 워크스페이스 관리자(owner)만 할 수 있습니다");

  const { guideId } = await params;
  if (!z.uuid().safeParse(guideId).success) return fail(400, "콘텐츠 번호가 올바르지 않습니다.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_guides")
    .delete()
    .eq("id", guideId)
    .eq("workspace_id", mine.workspace.id)
    .select("id").maybeSingle();

  if (error) return fail(500, "콘텐츠를 삭제하지 못했습니다.");
  if (!data) return fail(404, "콘텐츠를 찾을 수 없습니다.");
  return NextResponse.json({ ok: true });
}
