import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { ReviewStatus } from "@/lib/schemas/common";
import { ReviewStateBadge } from "./ad-badges";

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
}: ReviewBarProps) {
  const statusHint = !persisted ? "샘플 모드 · 저장되지 않음" :
    saveState === "saving"
      ? "저장 중..."
      : saveState === "saved"
        ? "DB에 저장됨"
        : saveState === "error"
          ? saveError ?? "저장 실패"
          : canApprove
            ? "판정 결과 자동 저장됨 · 상태 변경 시 DB에 반영"
            : "판정 결과 자동 저장됨 · 승인/반려는 관리자(owner)만 가능";

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
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={!canApprove || saveState === "saving"}
            aria-pressed={status === "approved"}
            variant={status === "approved" ? "default" : "outline"}
            onClick={() => onStatusChange("approved")}
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
