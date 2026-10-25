// PATCH /api/ad-check/[checkId] (CLAUDE.md 6장): 담당자 검토 결과(승인/반려/전문가 요청/메모/최종 문구) 저장.
// DELETE: 검토 숨김 (deleted_at). 약기법 검토는 증거로 남기려고 행을 지우지 않는다 (docs/tab3-db-plan.md). owner만.
// 승인/반려 상태 변경 권한은 워크스페이스 owner에게만 있다 (PM 결정 2026-10-24, RLS와 서버 양쪽에서 확인).
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, getMyWorkspace, isSupabaseConfigured } from "@/lib/data/workspace";
import { ReviewStatus } from "@/lib/schemas/common";
import { createClient } from "@/lib/supabase/server";

const PatchBody = z.object({
  review_status: ReviewStatus,
  is_expert_review_requested: z.boolean(),
  reviewer_note: z.string().nullable(),
  final_text: z.string().optional(),
});

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ checkId: string }> }) {
  if (!isSupabaseConfigured()) return fail(409, "샘플 모드에서는 저장할 수 없습니다.");
  const [user, mine] = await Promise.all([getCurrentUser(), getMyWorkspace()]);
  if (!user || !mine) return fail(401, "로그인이 필요합니다");
  if (mine.role !== "owner") return fail(403, "승인·반려 저장은 워크스페이스 관리자(owner)만 할 수 있습니다");

  const parsed = PatchBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, "입력이 올바르지 않습니다");

  const { checkId } = await params;
  if (!z.uuid().safeParse(checkId).success) return fail(400, "검토 번호가 올바르지 않습니다.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ad_checks")
    .update({
      review_status: parsed.data.review_status,
      is_expert_review_requested: parsed.data.is_expert_review_requested,
      reviewer_note: parsed.data.reviewer_note,
      ...(parsed.data.final_text !== undefined ? { final_text: parsed.data.final_text } : {}),
      reviewer_id: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", checkId)
    .eq("workspace_id", mine.workspace.id)
    .select("id").maybeSingle();

  if (error) return fail(500, "검토 결과를 저장하지 못했습니다.");
  if (!data) return fail(404, "검토 내역을 찾을 수 없습니다.");
  return NextResponse.json({ ok: true, saved: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ checkId: string }> }) {
  if (!isSupabaseConfigured()) return fail(409, "샘플 모드에서는 삭제할 수 없습니다.");
  const mine = await getMyWorkspace();
  if (!mine) return fail(401, "로그인이 필요합니다");
  if (mine.role !== "owner") return fail(403, "삭제는 워크스페이스 관리자(owner)만 할 수 있습니다");

  const { checkId } = await params;
  if (!z.uuid().safeParse(checkId).success) return fail(400, "검토 번호가 올바르지 않습니다.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ad_checks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", checkId)
    .eq("workspace_id", mine.workspace.id)
    .is("deleted_at", null)
    .select("id").maybeSingle();

  if (error) return fail(500, "검토를 삭제하지 못했습니다.");
  if (!data) return fail(404, "검토 내역을 찾을 수 없습니다.");
  return NextResponse.json({ ok: true });
}
