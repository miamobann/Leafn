import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { ReviewStatus } from "@/lib/schemas/common";
import { ReviewStateBadge } from "./ad-badges";

/** 승인 전 경고 (CLAUDE.md 1장: 결재가 약기법 검토를 대신하지 않는다). 막지는 않고, 승인을 누르면 한 번 더 묻는다 */
export function approveWarningOf({ mustFixLeft, expertRequested }: { mustFixLeft: number; expertRequested: boolean }): string | null {
  const parts = [
    mustFixLeft > 0 ? `「고쳐야 함」 줄 ${mustFixLeft}개가 대체 표현 없이 그대로예요` : null,
    expertRequested ? "전문가 확인을 요청한 검토예요" : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

type ReviewBarProps = {
  finalText: string;
  note: string;
  onNoteChange: (note: string) => void;
  status: ReviewStatus;
  expertRequested: boolean;
  onStatusChange: (status: ReviewStatus) => void;
  onExpertToggle: () => void;
  persisted?: boolean;
  canApprove?: boolean;
  saveState?: "idle" | "saving" | "saved" | "error";
  saveError?: string | null;
  onSaveNote?: () => void;
  onReset?: () => void;
  /** 있으면 화면에 보여 주고, 「내부 검토 완료」를 누를 때 한 번 더 묻는다 */
  approveWarning?: string | null;
};

export function ReviewBar({
  finalText,
  note,
  onNoteChange,
  status,
  expertRequested,
  onStatusChange,
  onExpertToggle,
  persisted = true,
  canApprove = true,
  saveState = "idle",
  saveError = null,
  onSaveNote,
  onReset,
  approveWarning = null,
}: ReviewBarProps) {
  const statusHint = !persisted ? "저장되지 않았어요" :
    saveState === "saving"
      ? "저장 중..."
      : saveState === "saved"
        ? "저장됨"
        : saveState === "error"
          ? saveError ?? "저장 실패"
          : canApprove
            ? "자동 저장됨"
            : "자동 저장됨 · 승인·반려는 팀장만 할 수 있어요";

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          담당자 검토 <ReviewStateBadge status={status} expertRequested={expertRequested} />
          <span className={`text-xs font-normal ${saveState === "error" ? "text-destructive" : "text-muted-foreground"}`}>{statusHint}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="mb-1 text-sm font-medium">
            최종 문구 <span className="font-normal text-muted-foreground">(선택한 대체 표현이 반영됨)</span>
          </p>
          <p className="whitespace-pre-line rounded-md bg-muted p-3 text-sm leading-relaxed">{finalText}</p>
        </div>
        <div>
          <label htmlFor="ad-note" className="mb-1 block text-sm font-medium">
            메모
          </label>
          <Textarea
            id="ad-note"
            rows={3}
            value={note}
            disabled={!canApprove}
            placeholder={canApprove ? "판단 이유, 전문가에게 물어볼 점 등" : "관리자(owner)만 검토 메모와 승인 상태를 저장할 수 있습니다"}
            onChange={(e) => onNoteChange(e.target.value)}
            onBlur={onSaveNote}
          />
        </div>
        {approveWarning && canApprove && status !== "approved" && (
          <p className="rounded-md border border-risk-high/40 p-2 text-sm text-risk-high">승인 전 확인 · {approveWarning}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={!canApprove || saveState === "saving"}
            aria-pressed={status === "approved"}
            variant={status === "approved" ? "default" : "outline"}
            onClick={() => {
              if (status !== "approved" && approveWarning && !window.confirm(`${approveWarning}.\n그래도 「내부 검토 완료」로 둘까요? (법적 승인이 아니에요)`)) return;
              onStatusChange("approved");
            }}
          >
            ✓ 내부 검토 완료
          </Button>
          <Button
            type="button"
            disabled={!canApprove || saveState === "saving"}
            aria-pressed={status === "rejected"}
            variant={status === "rejected" ? "default" : "outline"}
            onClick={() => onStatusChange("rejected")}
          >
            ✕ 반려
          </Button>
          <Button
            type="button"
            disabled={!canApprove || saveState === "saving"}
            aria-pressed={expertRequested}
            variant={expertRequested ? "default" : "outline"}
            onClick={onExpertToggle}
          >
            ? 전문가 확인 요청
          </Button>
          {canApprove && (status !== "pending" || expertRequested) && (
            <Button
              type="button"
              variant="ghost"
              disabled={saveState === "saving"}
              onClick={onReset}
            >
              되돌리기
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">「내부 검토 완료」는 팀 내부 검토를 마쳤다는 뜻이며 법적 승인이 아닙니다.</p>
      </CardContent>
    </Card>
  );
}
