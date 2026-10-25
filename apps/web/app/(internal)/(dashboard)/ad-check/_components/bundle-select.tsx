"use client";

// 만든 가이드 목록의 「선택한 가이드 PDF로 묶기」. 표 안 체크 칸은 form 속성으로 이 폼에 붙는다 (표를 폼으로 감싸지 않는다).
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export const BUNDLE_FORM_ID = "guide-bundle";

export function BundleSelect({ max }: { max: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const boxes = () => Array.from(document.querySelectorAll<HTMLInputElement>(`input[form="${BUNDLE_FORM_ID}"]`));
    // 최대 개수를 채우면 나머지 칸을 잠근다
    const update = () => {
      const checked = boxes().filter((b) => b.checked).length;
      setCount(checked);
      for (const b of boxes()) b.disabled = !b.checked && checked >= max;
    };
    document.addEventListener("change", update);
    update();
    return () => document.removeEventListener("change", update);
  }, [max]);

  return (
    <form id={BUNDLE_FORM_ID} action="/ad-check/guide/history/print" method="get" className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">
        {count}개 선택 · 최대 {max}개
      </span>
      <Button type="submit" size="sm" disabled={count === 0}>
        선택한 가이드 PDF로 묶기
      </Button>
    </form>
  );
}

/** 표 한 줄의 체크 칸 */
export function BundleCheckbox({ id, label }: { id: string; label: string }) {
  return <input type="checkbox" name="ids" value={id} form={BUNDLE_FORM_ID} aria-label={`${label} 묶기`} className="size-4" />;
}
