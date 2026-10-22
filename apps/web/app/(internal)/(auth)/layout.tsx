export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar p-6">
      <div className="w-full max-w-sm rounded-xl border border-border bg-background p-8">{children}</div>
    </div>
  );
}
