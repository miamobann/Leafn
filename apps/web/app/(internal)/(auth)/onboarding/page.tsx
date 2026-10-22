import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isSupabaseConfigured } from "@/lib/data/workspace";
import { OnboardingForms } from "./onboarding-forms";

const TEXT = {
  title: "워크스페이스 시작",
  notConfigured: "Supabase가 연결되지 않았습니다. docs/SUPABASE_SETUP.md를 먼저 따라 주세요.",
  back: "샘플 화면으로 돌아가기",
};

export default async function OnboardingPage() {
  if (isSupabaseConfigured() && !(await getCurrentUser())) redirect("/login");
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">{TEXT.title}</h1>
      {isSupabaseConfigured() ? (
        <OnboardingForms />
      ) : (
        <p className="rounded-md border border-border p-3 text-sm text-muted-foreground">{TEXT.notConfigured}</p>
      )}
      <Link href="/" className="mt-6 block text-center text-sm text-muted-foreground hover:underline">
        {TEXT.back}
      </Link>
    </>
  );
}
