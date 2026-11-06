import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/data/workspace";
import { Button } from "@/components/ui/button";
import { LoginForm } from "./login-form";

const TEXT = {
  title: "Leafn 로그인",
  notConfigured: "Supabase가 연결되지 않았습니다. docs/SUPABASE_SETUP.md를 따라 apps/web/.env.local을 만들어 주세요.",
  signup: "처음이신가요? 가입하기",
  guest: "게스트로 둘러보기",
  guestHelp: "로그인 없이 데모 데이터를 읽기 전용으로 볼 수 있어요.",
  guestFailed: "게스트 접속을 준비하지 못했습니다. 잠시 뒤 다시 시도해 주세요.",
  confirmFailed: "확인 링크가 만료됐거나 이미 사용됐습니다. 다시 로그인하거나 가입해 주세요.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">{TEXT.title}</h1>
      {error === "confirm" && (
        <p role="alert" className="mb-4 rounded-md border border-border p-3 text-sm text-destructive">
          {TEXT.confirmFailed}
        </p>
      )}
      {error === "guest" && (
        <p role="alert" className="mb-4 rounded-md border border-border p-3 text-sm text-destructive">
          {TEXT.guestFailed}
        </p>
      )}
      {/* 게스트 버튼은 데모 계정(DEMO_USER_ID)을 설정한 배포에서만 보인다 */}
      {isSupabaseConfigured() && process.env.DEMO_USER_ID && (
        <form action="/auth/guest" method="post" className="mb-6 space-y-2">
          <Button type="submit" className="w-full">
            {TEXT.guest}
          </Button>
          <p className="text-center text-xs text-muted-foreground">{TEXT.guestHelp}</p>
        </form>
      )}
      {isSupabaseConfigured() ? (
        <LoginForm />
      ) : (
        <p className="rounded-md border border-border p-3 text-sm text-muted-foreground">{TEXT.notConfigured}</p>
      )}
      {isSupabaseConfigured() && (
        <Link href="/signup" className="mt-4 block text-center text-sm hover:underline">
          {TEXT.signup}
        </Link>
      )}
    </>
  );
}
