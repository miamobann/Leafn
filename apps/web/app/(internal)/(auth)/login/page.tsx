import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/data/workspace";
import { LoginForm } from "./login-form";

const TEXT = {
  title: "Leafn 로그인",
  notConfigured: "Supabase가 연결되지 않았습니다. docs/SUPABASE_SETUP.md를 따라 apps/web/.env.local을 만들어 주세요.",
  skip: "로그인 없이 샘플 화면 보기",
  account: "계정은 워크스페이스 관리자에게 요청하세요.",
};

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">{TEXT.title}</h1>
      {isSupabaseConfigured() ? (
        <LoginForm />
      ) : (
        <p className="rounded-md border border-border p-3 text-sm text-muted-foreground">{TEXT.notConfigured}</p>
      )}
      <p className="mt-4 text-center text-xs text-muted-foreground">{TEXT.account}</p>
      <Link href="/" className="mt-2 block text-center text-sm text-muted-foreground hover:underline">
        {TEXT.skip}
      </Link>
    </>
  );
}
