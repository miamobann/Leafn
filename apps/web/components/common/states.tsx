import { Skeleton } from "@/components/ui/skeleton";

export function EmptyState({ message = "아직 데이터가 없어요", action }: { message?: string; action?: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
      <p>{message}</p>
      {action && <p className="font-medium text-foreground">{action}</p>}
    </div>
  );
}

export function LoadingState({ step }: { step?: string }) {
  return (
    <div className="space-y-3" aria-busy="true">
      {step && <p className="text-sm text-muted-foreground">{step}</p>}
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export function ErrorState({ message = "데이터를 불러오지 못했어요" }: { message?: string }) {
  return (
    <div role="alert" className="rounded-lg border border-destructive/40 p-6 text-sm">
      <p className="font-medium text-destructive">⚠ {message}</p>
      <p className="mt-1 text-muted-foreground">잠시 후 다시 시도해 주세요.</p>
    </div>
  );
}
