// 서버(Server Component, Server Action, Route Handler)용 Supabase 클라이언트.
// 로그인 세션은 쿠키로 읽는다. service role 키는 여기서 쓰지 않는다.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv } from "./env";

export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = supabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component에서는 쿠키를 쓸 수 없다. 세션 갱신은 로그인 작업(1-2) 때 middleware로 처리한다.
        }
      },
    },
  });
}
