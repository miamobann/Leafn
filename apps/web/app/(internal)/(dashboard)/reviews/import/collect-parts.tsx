// 수집 화면의 작은 표시 부품: 입력 칸 틀, 단계 표시, 저장 상태 칸.
import type { ReactNode } from "react";
import type { CollectionRowView, StarView } from "@/lib/data/collection";
import { STEPS } from "./collect-options";

export const DOT = {
  none: "bg-muted-foreground/40",
  some: "bg-status-pending",
  all: "bg-status-approved",
  busy: "bg-primary animate-pulse",
  failed: "bg-status-rejected",
} as const;

export const selectClass = "h-8 w-full rounded-md border bg-background px-2 text-sm disabled:opacity-50";
export const n = (value: number) => value.toLocaleString("en-US");

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function StepBar({ stage }: { stage: 1 | 2 | 3 }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm">
      {STEPS.map((label, i) => {
        const step = i + 1;
        const on = step === stage;
        return (
          <li key={label} className="flex items-center gap-2">
            <span className={`flex size-5 items-center justify-center rounded-full text-xs ${on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {step}
            </span>
            <span className={on ? "font-medium" : "text-muted-foreground"}>{label}</span>
            {step < STEPS.length && <span className="text-muted-foreground">›</span>}
          </li>
        );
      })}
    </ol>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function starText(stars: StarView[], pick: (x: StarView) => number) {
  return stars
    .filter((x) => pick(x) > 0)
    .map((x) => `${x.star}점 ${n(pick(x))}건`)
    .join(" · ");
}

/**
 * 저장 상태는 DB의 숫자로만 정한다.
 * 이전에 저장한 적이 없으면 "저장 안 함", 저장한 적이 있고 새로 저장할 리뷰가 있으면 "일부 저장", 없으면 "모두 저장됨".
 */
export function StateCell({ row, saved }: { row: CollectionRowView; saved: boolean }) {
  const hasHistory = row.savedCount > 0;
  const savedText = starText(row.stars, (x) => x.saved);
  const newText = starText(row.stars, (x) => x.newCount);
  let dot: string = DOT.none;
  let title = "저장 안 함";
  let detail: string | null = row.newCount > 0 ? `${newText} 저장할 수 있어요` : null;

  if (row.failed) {
    dot = DOT.failed;
    title = "읽지 못했어요";
    detail = row.note;
  } else if (hasHistory && row.newCount > 0) {
    dot = DOT.some;
    title = `일부 저장 · ${n(row.savedCount)}건 저장됨`;
    detail = `새로 ${newText} 저장할 수 있어요`;
  } else if (hasHistory) {
    dot = DOT.all;
    title = `모두 저장됨 · ${n(row.savedCount)}건`;
    detail = saved && row.savedNow !== null ? `이번에 새로 저장한 리뷰 ${n(row.savedNow)}건` : "새로 저장할 리뷰가 없어요";
  }

  const last = formatDate(row.lastSaved);
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2">
        <span className={`size-2 rounded-full ${dot}`} aria-hidden />
        <span className="font-medium">{title}</span>
      </div>
      {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      {hasHistory && savedText && <p className="text-xs text-muted-foreground">저장된 리뷰: {savedText}</p>}
      {hasHistory && last && <p className="text-xs text-muted-foreground">마지막 저장 {last}</p>}
    </div>
  );
}
