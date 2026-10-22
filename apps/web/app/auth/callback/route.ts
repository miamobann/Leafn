// 가입 확인 메일의 링크가 돌아오는 곳. 세션을 만들고 next로 보낸다.
// PKCE(?code=)와 이메일 OTP(?token_hash=&type=) 두 형식을 모두 받는다.
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = searchParams.get("next");
  // 다른 사이트로 보내지 않도록 내부 경로만 허용한다
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/onboarding";

  const supabase = await createClient();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("missing code") };

  if (error) return NextResponse.redirect(`${origin}/login?error=confirm`);
  return NextResponse.redirect(`${origin}${target}`);
}
