// 게스트로 둘러보기: 데모 계정 세션을 서버에서 만들어 홈으로 보낸다.
// 비밀번호 없이 service role로 매직 링크 토큰을 만들고 바로 검증한다 (메일은 보내지 않는다).
// 게스트가 데모 계정 비밀번호를 바꿔도 이 경로는 계속 동작한다.
// 필요한 환경 변수(서버 전용): DEMO_USER_ID, SUPABASE_SERVICE_ROLE_KEY
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { origin } = request.nextUrl;
  const fail = () => NextResponse.redirect(`${origin}/login?error=guest`, 303);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const demoUserId = process.env.DEMO_USER_ID;
  if (!url || !serviceKey || !demoUserId) return fail();

  const admin = createAdminClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: found, error: findError } = await admin.auth.admin.getUserById(demoUserId);
  const user = found?.user;
  // demo 표시가 없는 계정으로는 세션을 만들지 않는다 (DEMO_USER_ID를 잘못 넣어도 실제 팀원 계정이 열리지 않게)
  if (findError || !user?.email || user.app_metadata?.demo !== true) {
    console.error("[게스트] 데모 계정 확인 실패", findError?.message ?? "demo 표시 없음");
    return fail();
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: user.email });
  if (linkError || !link.properties?.hashed_token) {
    console.error("[게스트] 로그인 토큰 생성 실패", linkError?.message);
    return fail();
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
  if (error) {
    console.error("[게스트] 세션 생성 실패", error.message);
    return fail();
  }
  return NextResponse.redirect(`${origin}/`, 303);
}
