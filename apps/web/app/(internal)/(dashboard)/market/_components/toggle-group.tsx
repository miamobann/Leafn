"use client";

import { Button } from "@/components/ui/button";

/** 필터 바의 단일 선택 버튼 묶음 (카테고리 등) */
export function ToggleGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1">
      <span className="mr-1 text-xs text-muted-foreground">{label}</span>
      {options.map((o) => (
        <Button key={o} size="sm" variant={o === value ? "default" : "outline"} aria-pressed={o === value} onClick={() => onChange(o)}>
          <span lang={/[ぁ-んァ-ン一-龥]/.test(o) ? "ja" : undefined}>{o}</span>
        </Button>
      ))}
    </div>
  );
}
