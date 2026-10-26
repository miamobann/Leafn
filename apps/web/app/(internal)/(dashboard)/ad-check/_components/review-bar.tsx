import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { ReviewStatus } from "@/lib/schemas/common";
import { ReviewStateBadge } from "./ad-badges";

// 검토 기록의 메모 · 전문가 확인 요청 (팀장만 저장). 승인 · 반려는 결재함에서 한다 (2026-10-27 결정: 결재가 우선, 검토 화면의 승인 버튼은 뺀다).
// 예전에 「내부 검토 완료」 · 반려로 둔 검토는 상태 배지로만 보여 준다.

type ReviewBarProps = {
  finalText: string;
  note: string;
  onNoteChange: (note: string) => void;
  status: ReviewStatus;
  expertRequested: boolean;
  onExpertToggle: () => void;
  persisted?: boolean;
  canApprove?: boolean;
  saveState?: "idle" | "saving" | "saved" | "error";
  saveError?: string | null;
  onSaveNote?: () => void;
  /** 최종 문구 칸을 보일지 (검토 상세는 「원문 · 최종 문구 전체 보기」에 따로 있어 숨긴다) */
  showFinalText?: boolean;
};

export function ReviewBar({
  finalText,
  note,
  onNoteChange,
  status,
  expertRequested,
  onExpertToggle,
  persisted = true,
  canApprove = true,
  saveState = "idle",
  saveError = null,
  onSaveNote,
  showFinalText = true,
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
            : "자동 저장됨 · 메모와 전문가 확인 요청은 팀장만 저장할 수 있어요";

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          검토 메모 {(status !== "pending" || expertRequested) && <ReviewStateBadge status={status} expertRequested={expertRequested} />}
          <span className={`text-xs font-normal ${saveState === "error" ? "text-destructive" : "text-muted-foreground"}`}>{statusHint}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {showFinalText && (
        <div>
          <p className="mb-1 text-sm font-medium">
            최종 문구 <span className="font-normal text-muted-foreground">(선택한 대체 표현이 반영됨)</span>
          </p>
          <p className="whitespace-pre-line rounded-md bg-muted p-3 text-sm leading-relaxed">{finalText}</p>
        </div>
        )}
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
            aria-pressed={expertRequested}
            variant={expertRequested ? "default" : "outline"}
            onClick={onExpertToggle}
          >
            ? 전문가 확인 요청
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">승인 · 반려는 결재함에서 해요. 아래 「시안 · 결재」에서 결재를 올려 주세요 (팀장 결재는 법적 승인이 아니에요).</p>
      </CardContent>
    </Card>
  );
}
