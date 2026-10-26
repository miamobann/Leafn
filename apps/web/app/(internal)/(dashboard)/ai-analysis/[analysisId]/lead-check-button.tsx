"use client";

// 팀장 확인 (owner만, docs/team-approval-ai-analysis.md 2장 · 8장 보완 8). 누르면 "AI 결과 · 팀장 확인 전" 라벨이 바뀐다
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { checkAiAnalysis } from "@/lib/data/submission-actions";

export function LeadCheckButton({ analysisId }: { analysisId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await checkAiAnalysis(analysisId);
            if (!result.ok) {
              setError(result.message);
              return;
            }
            router.refresh();
          })
        }
      >
        {pending ? "저장 중…" : "팀장 확인"}
      </Button>
      {error && (
        <span role="alert" className="text-sm text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}
