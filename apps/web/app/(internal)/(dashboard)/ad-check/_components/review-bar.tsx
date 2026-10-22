import { StatusBadge } from "./badges";
import { STATUS_DISPLAY } from "../_lib/display";
import type { ReviewStatus } from "../_lib/types";

const DECISIONS: Exclude<ReviewStatus, "pending">[] = ["internal_done", "rejected", "expert_requested"];

type ReviewBarProps = {
  finalText: string;
  note: string;
  onNoteChange: (note: string) => void;
  status: ReviewStatus;
  onStatusChange: (status: ReviewStatus) => void;
};

export function ReviewBar({ finalText, note, onNoteChange, status, onStatusChange }: ReviewBarProps) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">담당자 검토</h2>
        <StatusBadge status={status} />
        <span className="text-xs text-muted">저장되지 않음</span>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium">
          최종 문구 <span className="font-normal text-muted">(선택한 대체 표현이 반영됨)</span>
        </p>
        <p className="whitespace-pre-line rounded-md bg-sidebar p-3 text-sm leading-relaxed">{finalText}</p>
      </div>

      <div>
        <label htmlFor="ad-note" className="mb-1 block text-sm font-medium">
          메모
        </label>
        <textarea
          id="ad-note"
          className="min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={note}
          placeholder="판단 이유, 전문가에게 물어볼 점 등"
          onChange={(e) => onNoteChange(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {DECISIONS.map((decision) => (
          <button
            key={decision}
            type="button"
            aria-pressed={status === decision}
            onClick={() => onStatusChange(decision)}
            className={`rounded-md border px-4 py-2 text-sm ${STATUS_DISPLAY[decision].badge} ${
              status === decision ? "ring-2 ring-foreground" : ""
            }`}
          >
            <span aria-hidden>{STATUS_DISPLAY[decision].icon} </span>
            {STATUS_DISPLAY[decision].label}
          </button>
        ))}
        {status !== "pending" && (
          <button
            type="button"
            onClick={() => onStatusChange("pending")}
            className="rounded-md px-4 py-2 text-sm text-muted hover:bg-sidebar"
          >
            되돌리기
          </button>
        )}
      </div>
      <p className="text-xs text-muted">「내부 검토 완료」는 팀 내부 검토를 마쳤다는 뜻이며 법적 승인이 아닙니다.</p>
    </section>
  );
}
