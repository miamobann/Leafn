import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// 높이: 기본 32px, 촘촘한 표·필터 28px. 모서리·테두리·포커스 링은 공통 입력 칸(components/ui/input.tsx)과 같다
const SIZE = {
  default: "h-8",
  sm: "h-7",
} as const;

/**
 * 브라우저 기본 선택 상자(select)를 공통 입력 칸과 같은 모양으로 감싼 것 (디자인 전환 3단계).
 * 모바일·키보드·화면 읽기 동작은 기본 select 그대로 둔다. 폭은 쓰는 곳에서 정한다
 */
export function NativeSelect({
  className,
  size = "default",
  ...props
}: Omit<ComponentProps<"select">, "size"> & { size?: keyof typeof SIZE }) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
        SIZE[size],
        className,
      )}
      {...props}
    />
  );
}
