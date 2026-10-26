"use client";

// 최종 문구를 디자이너·에이전시에 넘기기 쉽게 클립보드로 복사한다 (실무자 비판 7번).
// 글자 대신 복사 아이콘(겹친 네모)만 보인다. 이름은 마우스를 올리면 보이고 화면 읽기 도구가 읽는다 (2026-10-27)
import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyButton({ text, label = "복사" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.alert("복사하지 못했어요. 문구를 직접 선택해서 복사해 주세요.");
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={copy}
      title={copied ? "복사됨" : label}
      aria-label={copied ? "복사됨" : label}
      aria-live="polite"
      className={copied ? "text-primary" : "text-muted-foreground hover:text-primary"}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  );
}
