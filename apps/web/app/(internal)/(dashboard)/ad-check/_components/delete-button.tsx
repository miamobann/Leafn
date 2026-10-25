"use client";

// 목록·상세의 삭제 버튼. owner(팀장) 화면에만 그린다 (서버에서 role 확인 후 렌더, API·RLS도 owner만 허용)
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type DeleteButtonProps = {
  /** DELETE 를 보낼 주소 (/api/ad-check/<id> · /api/content-guide/<id>) */
  endpoint: string;
  /** 확인 창 문구 */
  confirmMessage: string;
  /** 지운 뒤 갈 주소. 없으면 지금 화면을 새로 읽는다 */
  redirectTo?: string;
};

export function DeleteButton({ endpoint, confirmMessage, redirectTo }: DeleteButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!window.confirm(confirmMessage)) return;
    setBusy(true);
    const res = await fetch(endpoint, { method: "DELETE" }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { error?: string } | null;
    setBusy(false);
    if (!res?.ok) return window.alert(json?.error ?? "삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={remove} className="border-destructive/40 text-destructive hover:text-destructive">
      {busy ? "삭제 중…" : "삭제"}
    </Button>
  );
}
