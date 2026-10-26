"use client";

// 승인 · 반려 (팀장만, docs/team-approval-ai-analysis.md 6장). 반려는 사유 필수.
// 근거 광고 문구에 위험 높음 · 전문가 확인 요청이 있으면 승인 전에 확인 체크를 받는다 (8장 보완 7)
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { decideVersion } from "@/lib/data/submission-actions";
import type { Decision } from "@/lib/schemas/submission";

const TEXT = {
  title: "결재",
  reason: "반려 사유 (반려할 때 필수)",
  reasonPlaceholder: "예) 「角質層まで」도 침투 표현으로 읽힐 수 있어요. 전문가 확인 뒤 다시 올려 주세요.",
  approve: "승인",
  reject: "반려",
  saving: "저장 중…",
  self: "내가 만든 버전이에요. 결재 기록에 「자기 결재」로 남아요.",
  riskCheck: "약기법 검토 결과(위험 표현 · 전문가 확인 요청)를 확인했고, 이 결재가 그 판단을 대신하지 않는다는 것을 알고 있어요",
  needsReason: "반려 사유를 적어 주세요",
};

export function DecisionForm({ versionId, isSelf, riskWarning }: { versionId: string; isSelf: boolean; riskWarning: string | null }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [riskChecked, setRiskChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function decide(decision: Decision) {
    if (decision === "rejected" && !reason.trim()) {
      setError(TEXT.needsReason);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await decideVersion(versionId, decision, reason, riskChecked);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="mt-6 space-y-3 rounded-xl border bg-card p-5">
      <h2 className="font-semibold">{TEXT.title}</h2>
      {isSelf && <p className="text-sm text-muted-foreground">{TEXT.self}</p>}
      {riskWarning && (
        <div role="note" className="space-y-2 rounded-md border border-risk-high/40 bg-risk-high/5 p-3 text-sm">
          <p>{riskWarning}</p>
          <label className="flex items-start gap-2">
            <Checkbox className="mt-0.5" checked={riskChecked} onCheckedChange={(on) => setRiskChecked(on)} />
            <span>{TEXT.riskCheck}</span>
          </label>
        </div>
      )}
      <label className="block space-y-1 text-sm">
        <span className="font-medium">{TEXT.reason}</span>
        <Textarea value={reason} rows={3} maxLength={1000} placeholder={TEXT.reasonPlaceholder} onChange={(e) => setReason(e.target.value)} />
      </label>
      <div className="flex gap-2">
        <Button disabled={pending || (riskWarning !== null && !riskChecked)} onClick={() => decide("approved")}>
          {pending ? TEXT.saving : TEXT.approve}
        </Button>
        <Button variant="outline" disabled={pending} onClick={() => decide("rejected")}>
          {TEXT.reject}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
