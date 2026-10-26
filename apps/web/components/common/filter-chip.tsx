import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * 필터·구역을 고르는 알약 칩 (디자인 전환 3단계). 선택된 칩은 구역 탭(section-tabs.tsx)과 같은 연한 바탕이다.
 * 선택 여부는 aria-pressed로 화면 읽기 프로그램에도 알린다
 */
export function FilterChip({
  active = false,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type={type}
      aria-pressed={active}
      data-slot="filter-chip"
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
        active
          ? "border-transparent bg-accent font-medium text-accent-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-accent/60 hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}
