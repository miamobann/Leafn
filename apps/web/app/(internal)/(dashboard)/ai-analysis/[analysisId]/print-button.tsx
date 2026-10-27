"use client";

// AI 분석 보고서 PDF 내보내기: 브라우저 인쇄 → 「PDF로 저장」 (콘텐츠 제작 가이드 보고서와 같은 방식)
import { Button } from "@/components/ui/button";

export function PrintReportButton() {
  return (
    <Button type="button" variant="outline" size="sm" onClick={() => window.print()} title="인쇄 창에서 대상을 「PDF로 저장」으로 고르세요">
      PDF 보고서
    </Button>
  );
}
