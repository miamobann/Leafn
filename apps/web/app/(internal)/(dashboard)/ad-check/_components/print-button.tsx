"use client";

import { Button } from "@/components/ui/button";

/** 인쇄 창을 연다 (「PDF로 저장」을 고르면 PDF) */
export function PrintButton({ label = "PDF 출력" }: { label?: string }) {
  return (
    <Button type="button" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
