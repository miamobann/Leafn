// 레이아웃 단계의 빈 화면 자리. 각 담당자가 실제 화면으로 교체한다.
export function Placeholder({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex min-h-64 items-center justify-center rounded-lg border border-dashed border-border p-8 text-sm text-muted">
      {children ?? "화면 준비 중"}
    </div>
  );
}
