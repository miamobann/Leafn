"use server";

// 설정 화면의 멤버별 담당 탭 저장 (docs/team-approval-ai-analysis.md 2장 "탭 담당", 4장 권한 표).
// 팀장(owner)만 주고 거둔다. RLS(member_tabs의 owners insert/delete)와 여기 양쪽에서 확인한다.
// workspace_id는 화면 입력을 믿지 않고 로그인한 워크스페이스로 채운다 (DB_RULES 4.1).
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SubmissionTab } from "@/lib/schemas/submission";
import { createClient } from "@/lib/supabase/server";
import { getMyWorkspace, isSupabaseConfigured } from "./workspace";

export type MemberTabResult = { ok: true } | { ok: false; message: string };

function saveError(error: { code?: string; message: string }) {
  if (error.code === "PGRST205" || error.code === "42P01") return "담당 탭 테이블이 아직 DB에 적용되지 않았어요";
  if (error.code === "23503") return "이 워크스페이스의 팀원이 아니에요";
  return `저장하지 못했어요: ${error.message}`;
}

export async function setMemberTab(userId: string, tab: SubmissionTab, granted: boolean): Promise<MemberTabResult> {
  if (!isSupabaseConfigured()) return { ok: false, message: "샘플 모드에서는 저장할 수 없어요" };
  const parsedTab = SubmissionTab.safeParse(tab);
  if (!z.uuid().safeParse(userId).success || !parsedTab.success || typeof granted !== "boolean") {
    return { ok: false, message: "입력값을 확인해 주세요" };
  }
  const mine = await getMyWorkspace();
  if (!mine) return { ok: false, message: "로그인한 워크스페이스가 없어요" };
  if (mine.role !== "owner") return { ok: false, message: "담당 탭은 팀장(owner)만 바꿀 수 있어요" };

  const supabase = await createClient();
  const { error } = granted
    ? await supabase.from("member_tabs").insert({ workspace_id: mine.workspace.id, user_id: userId, tab: parsedTab.data })
    : await supabase
        .from("member_tabs")
        .delete()
        .eq("workspace_id", mine.workspace.id)
        .eq("user_id", userId)
        .eq("tab", parsedTab.data);
  // 이미 준 탭을 다시 주는 것(unique 위반)은 성공으로 본다
  if (error && error.code !== "23505") return { ok: false, message: saveError(error) };
  revalidatePath("/settings");
  return { ok: true };
}
