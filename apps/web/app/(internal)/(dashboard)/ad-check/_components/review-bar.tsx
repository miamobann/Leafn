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
};

export function ReviewBar({ finalText, note, onNoteChange, status, expertRequested, onStatusChange, onExpertToggle }: ReviewBarProps) {
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          담당자 검토 <ReviewStateBadge status={status} expertRequested={expertRequested} />
          <span className="text-xs font-normal text-muted-foreground">저장되지 않음</span>
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
          <Textarea id="ad-note" rows={3} value={note} placeholder="판단 이유, 전문가에게 물어볼 점 등" onChange={(e) => onNoteChange(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" aria-pressed={status === "approved"} variant={status === "approved" ? "default" : "outline"} onClick={() => onStatusChange("approved")}>
            ✓ 내부 검토 완료
          </Button>
          <Button type="button" aria-pressed={status === "rejected"} variant={status === "rejected" ? "default" : "outline"} onClick={() => onStatusChange("rejected")}>
            ✕ 반려
          </Button>
          <Button type="button" aria-pressed={expertRequested} variant={expertRequested ? "default" : "outline"} onClick={onExpertToggle}>
            ? 전문가 확인 요청
          </Button>
          {(status !== "pending" || expertRequested) && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onStatusChange("pending");
                if (expertRequested) onExpertToggle();
              }}
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
