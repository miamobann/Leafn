"use client";

import { Button } from "@/components/ui/button";

export default function DataError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section role="alert" className="space-y-4 p-8">
      <h1 className="text-lg font-semibold">데이터를 불러오지 못했습니다</h1>
      <p>로그인과 워크스페이스 참여 상태를 확인해 주세요. 문제가 계속되면 관리자에게 문의해 주세요.</p>
      <Button onClick={reset}>다시 시도</Button>
    </section>
  );
}
