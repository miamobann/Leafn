// Supabase 환경 변수 읽기. 값이 없으면 어느 변수가 빠졌는지 알려준다.
// 브라우저 번들에 들어가려면 process.env.NEXT_PUBLIC_* 를 그대로 적어야 한다 (동적 접근 금지).
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase 환경 변수가 없습니다. apps/web/.env.local에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY를 넣어 주세요 (.env.example 참고).",
    );
  }
  return { url, anonKey };
}
