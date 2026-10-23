// 실제 Supabase에서 읽는 워크스페이스 함수 (서버 전용).
// 다른 화면이 쓰는 getWorkspace()/getMembers()는 아직 가짜 데이터라서 그대로 두고, 여기 함수는 설정·온보딩만 쓴다.
import { createClient } from "@/lib/supabase/server";
import { WorkspaceMember, Workspace } from "@/lib/schemas/workspace";

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** 로그인한 사용자. 로그인 안 했거나 Supabase를 연결하지 않았으면 null */
export async function getCurrentUser() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return null;
  return { id: data.claims.sub, email: (data.claims.email as string | undefined) ?? null };
}

/** 내가 속한 워크스페이스 중 가장 먼저 들어간 곳 (여러 개 소속은 허용, 화면은 하나만 쓴다) */
export async function getMyWorkspace() {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, workspaces (id, created_at, name, invite_code)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`워크스페이스를 불러오지 못했습니다: ${error.message}`);
  if (!data?.workspaces) return null;
  return { workspace: Workspace.parse(data.workspaces), role: data.role as "owner" | "member" };
}

export async function getMyWorkspaceMembers(workspaceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("id, created_at, workspace_id, user_id, role, profiles (display_name, title)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`팀원을 불러오지 못했습니다: ${error.message}`);
  return data.map(({ profiles, ...m }) => {
    const p = Array.isArray(profiles) ? profiles[0] : profiles;
    return WorkspaceMember.parse({ ...m, display_name: p?.display_name ?? undefined, title: p?.title ?? undefined });
  });
}
