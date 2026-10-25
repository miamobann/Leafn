"use server";

// 로그인·로그아웃·워크스페이스 만들기/참여 (Server Action)
import { headers } from "next/headers";
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

export type SignUpState = FormState & { sentTo?: string };

export async function signUp(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();
  if (!email || !password || !displayName) return { error: "이름, 이메일, 비밀번호를 모두 입력해 주세요." };
  if (password.length < 8) return { error: "비밀번호는 8자 이상으로 정해 주세요." };

  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // display_name은 가입 트리거(handle_new_user)가 profiles에 옮겨 담는다
    options: { data: { display_name: displayName }, emailRedirectTo: `${origin}/auth/callback?next=/onboarding` },
  });
  if (error) return { error: `가입하지 못했습니다: ${error.message}` };

  // 이메일 확인이 꺼져 있으면 바로 로그인된 상태로 돌아온다
  if (data.session) redirect("/onboarding");
  return { error: null, sentTo: email };
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
