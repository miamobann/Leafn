// 광고 검토 탭의 빈 상태·불러오는 중·오류 화면.
// 공통 상태 컴포넌트(components/common/)가 생기면 그것으로 바꾼다.

export type ViewState = "ready" | "empty" | "loading" | "error";

export function parseViewState(value: string | string[] | undefined): ViewState {
  return value === "empty" || value === "loading" || value === "error" ? value : "ready";
}

export function EmptyView({ message, children }: { message: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted">
      <p>{message}</p>
      {children}
    </div>
  );
}

export function LoadingView({ message }: { message: string }) {
  return (
    <div role="status" className="flex min-h-48 flex-col gap-3 rounded-lg border border-border p-6">
      <p className="text-sm text-muted">{message}</p>
      <div className="h-4 w-3/4 animate-pulse rounded bg-sidebar-accent" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-sidebar-accent" />
      <div className="h-4 w-2/3 animate-pulse rounded bg-sidebar-accent" />
    </div>
  );
}

export function ErrorView({ message, children }: { message: string; children?: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border border-red-300 bg-red-50 p-8 text-center text-sm text-red-800"
    >
      <p>
        <span aria-hidden>✕ </span>
        {message}
      </p>
      {children}
    </div>
  );
}
