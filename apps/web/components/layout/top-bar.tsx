export function TopBar() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
      <div className="text-sm text-muted">샘플 워크스페이스</div>
      <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted">
        샘플 데이터 · 저장되지 않음
      </span>
    </header>
  );
}
