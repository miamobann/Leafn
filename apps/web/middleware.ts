// 로그인 세션 쿠키를 매 요청마다 갱신한다 (Supabase SSR 권장 방식).
// 환경 변수가 없으면 아무것도 하지 않는다: Supabase를 연결하지 않은 팀원도 프로토타입 화면을 그대로 쓴다.
// 지금은 로그인하지 않아도 화면을 막지 않는다. 막는 시점은 화면이 실제 데이터로 바뀔 때 정한다.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // 토큰이 만료됐으면 여기서 새로 받는다. 이 호출과 createServerClient 사이에 다른 코드를 넣지 않는다.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|survey(?:/|$)|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
