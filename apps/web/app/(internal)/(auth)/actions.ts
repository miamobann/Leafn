"use server";

// 로그인·로그아웃·워크스페이스 만들기/참여 (Server Action)
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error: string | null };

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "이메일과 비밀번호를 입력해 주세요." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "이메일 또는 비밀번호가 맞지 않습니다." };

  const { data } = await supabase.from("workspace_members").select("id").limit(1);
  redirect(data && data.length > 0 ? "/settings" : "/onboarding");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createWorkspace(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "팀 이름을 입력해 주세요." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_workspace", { p_name: name });
  if (error) return { error: `워크스페이스를 만들지 못했습니다: ${error.message}` };
  redirect("/settings");
}

export async function joinWorkspace(_prev: FormState, formData: FormData): Promise<FormState> {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: "초대 코드를 입력해 주세요." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("join_workspace", { p_invite_code: code });
  if (error) return { error: `참여하지 못했습니다: ${error.message}` };
  redirect("/settings");
}
