"use client";

// 「가이드에 반영」: 만든 가이드에서 온 검토의 고른 대체 표현으로 가이드 수정본을 만든다 (POST /api/content-guide/[guideId]/revise).
// 새 검토(판정 직후)와 검토 상세(나중에 누구나, 팀장이 팀원 검토를 이어받기)에서 같이 쓴다. 약기법 우선: 「고쳐야 함」 줄은 대체 표현을 골라야 반영된다.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { AdFinding, AdLineResult } from "@/lib/schemas/ad-check";
import type { GuideReflectState } from "../_lib/guide-to-review";
import { ResultLines } from "./result-lines";

type ReviseFailure = { message: string; link?: { href: string; label: string } };

/** 반영 요청. 성공하면 수정본으로 이동한다. 이미 반영됐거나 더 새 수정본이 있으면 그쪽 링크를 같이 돌려준다 */
export function useGuideRevise(guideId: string | undefined) {
  const router = useRouter();
  const [revising, setRevising] = useState(false);
  const [failure, setFailure] = useState<ReviseFailure | null>(null);

  async function revise(checkId: string, picks: Record<number, string>) {
    if (!guideId) return;
    setRevising(true);
    setFailure(null);
    try {
      const res = await fetch(`/api/content-guide/${guideId}/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ad_check_id: checkId, picks }),
      });
      const json = (await res.json().catch(() => ({}))) as { id?: string; error?: string; revision_id?: string; latest_id?: string };
      if (res.ok && json.id) return router.push(`/ad-check/guide/history/${json.id}`);
      const link = json.revision_id
        ? { href: `/ad-check/guide/history/${json.revision_id}`, label: "수정본 보기 →" }
        : json.latest_id
          ? { href: `/ad-check/guide/history/${json.latest_id}`, label: "최신 수정본 보기 →" }
          : undefined;
      setFailure({ message: json.error ?? "가이드에 반영하지 못했어요", link });
    } catch {
      setFailure({ message: "서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요." });
    }
    setRevising(false);
  }

  return { revise, revising, failure, reset: () => setFailure(null) };
}

/** 반영 칸: 막힌 이유(입력 바뀜 · 고쳐야 함 줄) · 확인 필요 줄 안내 · 버튼 · 실패 안내 */
export function GuideRevisePanel({
  stale = false,
  mustFixLeft,
  checkLeft,
  revising,
  failure,
  onRevise,
}: {
  stale?: boolean;
  mustFixLeft: number;
  checkLeft: number;
  revising: boolean;
  failure: ReviseFailure | null;
  onRevise: () => void;
}) {
  const blocked = stale ? "입력이 바뀌었어요. 다시 판정한 뒤 반영할 수 있어요." : mustFixLeft > 0 ? `「고쳐야 함」 줄 ${mustFixLeft}개에 대체 표현을 골라 주세요.` : null;
  return (
    <div className="mt-4 space-y-2 rounded-lg border border-primary/40 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          가이드에 반영 · 고른 대체 표현으로 만든 가이드를 고쳐요. 고치기 전 버전과 검사 기록은 그대로 남아요.
          {!blocked && checkLeft > 0 && <span className="text-muted-foreground"> 확인이 필요한 줄 {checkLeft}개는 지금 문구 그대로 들어가요.</span>}
        </span>
        <Button type="button" size="sm" disabled={Boolean(blocked) || revising} onClick={onRevise}>
          {revising ? "반영 중…" : "가이드에 반영 →"}
        </Button>
      </div>
      {blocked && <p className="text-xs text-muted-foreground">{blocked}</p>}
      {failure && (
        <p className="text-xs text-destructive">
          {failure.message}
          {failure.link && (
            <Link href={failure.link.href} className="ml-2 text-primary underline-offset-4 hover:underline">
              {failure.link.label}
            </Link>
          )}
        </p>
      )}
    </div>
  );
}

/** 검토 상세: 줄별 판정 카드에서 대체 표현을 고르고 「가이드에 반영」 (팀장 · 팀원 누구나) */
export function GuideReflect({
  guideId,
  checkId,
  lines,
  findings,
  state,
}: {
  guideId: string;
  checkId: string;
  lines: AdLineResult[];
  findings: AdFinding[];
  state: GuideReflectState;
}) {
  const [selected, setSelected] = useState<Record<number, string>>({});
  const { revise, revising, failure } = useGuideRevise(guideId);
  const ready = state.kind === "ready";
  return (
    <div className="space-y-4">
      <ResultLines
        lines={lines}
        findings={findings}
        selected={selected}
        onSelect={
          ready
            ? (lineIndex, s) =>
                setSelected((prev) => {
                  const next = { ...prev };
                  if (s === null) delete next[lineIndex];
                  else next[lineIndex] = s;
                  return next;
                })
            : undefined
        }
      />
      {state.kind === "reflected" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
          <span>이 검토로 이미 가이드를 고쳤어요.</span>
          <Link href={`/ad-check/guide/history/${state.revisionId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            반영됨 · 수정본 보기 →
          </Link>
        </div>
      )}
      {state.kind === "stale" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
          <span>이 검토 뒤에 가이드가 다른 검토로 먼저 고쳐졌어요. 최신 수정본에서 다시 검토해 주세요.</span>
          <span className="flex flex-wrap gap-2">
            <Link href={`/ad-check/guide/history/${state.latestId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              최신 수정본 보기
            </Link>
            <Link href={`/ad-check?guide=${state.latestId}`} className={buttonVariants({ size: "sm" })}>
              최신 수정본에서 다시 검토 →
            </Link>
          </span>
        </div>
      )}
      {ready && (
        <GuideRevisePanel
          mustFixLeft={lines.filter((l) => l.action === "must_fix" && !selected[l.line_index]).length}
          checkLeft={lines.filter((l) => (l.action === "should_fix" || l.action === "expert") && !selected[l.line_index]).length}
          revising={revising}
          failure={failure}
          onRevise={() => void revise(checkId, selected)}
        />
      )}
    </div>
  );
}
