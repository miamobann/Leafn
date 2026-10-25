"use client";

// 최종 문구를 디자이너·에이전시에 넘기기 쉽게 클립보드로 복사한다 (실무자 비판 7번)
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
    <Button type="button" variant="outline" size="sm" onClick={copy} aria-live="polite">
      {copied ? "복사됨" : label}
    </Button>
  );
}
