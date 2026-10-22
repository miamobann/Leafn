import Link from "next/link";
import { Input } from "@/components/ui/input";

// 프로토타입은 가짜 로그인: 누르면 홈으로 이동 (인증 없음)
export default function LoginPage() {
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">Leafn 로그인</h1>
      <div className="space-y-3">
        <Input type="email" placeholder="이메일" />
        <Input type="password" placeholder="비밀번호" />
        <Link href="/" className="block rounded-md bg-primary py-2 text-center text-sm text-primary-foreground">
          로그인
        </Link>
        <Link href="/onboarding" className="block text-center text-sm text-muted-foreground hover:underline">
          처음이신가요? 워크스페이스 시작
        </Link>
      </div>
    </>
  );
}
