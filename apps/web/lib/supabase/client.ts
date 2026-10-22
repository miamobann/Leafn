// 브라우저(Client Component)용 Supabase 클라이언트.
// anon(publishable) 키만 쓴다. RLS가 데이터를 보호한다 (CLAUDE.md 9장).
import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

export function createClient() {
  const { url, anonKey } = supabaseEnv();
  return createBrowserClient(url, anonKey);
}
