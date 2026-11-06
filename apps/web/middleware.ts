// 로그인 세션 쿠키를 매 요청마다 갱신한다 (Supabase SSR 권장 방식).
// 환경 변수가 없으면 아무것도 하지 않는다: Supabase를 연결하지 않은 팀원도 프로토타입 화면을 그대로 쓴다.
// Supabase가 연결돼 있으면 로그인하지 않은 사용자는 로그인 화면으로 보낸다 (가입 링크·게스트 버튼이 거기 있다).
// 게스트(데모 계정)는 /api의 쓰기 요청(POST·PATCH·DELETE 등)을 여기서 막는다. Server Action 쓰기는 DB 트리거와 각 액션이 막는다.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { GUEST_READ_ONLY_MESSAGE, isGuestClaims } from "@/lib/supabase/guest";

// 로그인 없이 열 수 있는 경로 (/auth/guest 포함)
const PUBLIC_PATHS = ["/login", "/signup", "/auth"];
const READ_METHODS = ["GET", "HEAD", "OPTIONS"];

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
  const { data } = await supabase.auth.getClaims();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
  if (!data?.claims && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    const redirect = NextResponse.redirect(loginUrl);
    // 갱신된 쿠키(로그아웃 처리 등)를 그대로 넘긴다
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }
  if (data?.claims && isGuestClaims(data.claims) && path.startsWith("/api/") && !READ_METHODS.includes(request.method)) {
    return NextResponse.json({ error: GUEST_READ_ONLY_MESSAGE }, { status: 403 });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|survey(?:/|$)|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
