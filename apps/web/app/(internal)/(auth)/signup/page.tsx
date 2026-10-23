import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/data/workspace";
import { SignupForm } from "./signup-form";

const TEXT = {
  title: "Leafn 가입",
  hint: "가입한 뒤 워크스페이스를 만들거나, 팀에서 받은 초대 코드로 참여합니다.",
  notConfigured: "Supabase가 연결되지 않았습니다. docs/SUPABASE_SETUP.md를 따라 apps/web/.env.local을 만들어 주세요.",
  login: "이미 계정이 있나요? 로그인",
};

export default function SignupPage() {
  return (
    <>
      <h1 className="mb-2 text-xl font-semibold">{TEXT.title}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{TEXT.hint}</p>
      {isSupabaseConfigured() ? (
        <SignupForm />
      ) : (
        <p className="rounded-md border border-border p-3 text-sm text-muted-foreground">{TEXT.notConfigured}</p>
      )}
      <Link href="/login" className="mt-4 block text-center text-sm text-muted-foreground hover:underline">
        {TEXT.login}
      </Link>
    </>
  );
}
