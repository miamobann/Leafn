import type { AdAction, AdFinding } from "@/lib/schemas/ad-check";
import { ACTION_TONE } from "./ad-badges";

type Range = { start: number; end: number; reason: string };

// 위치(start/end)가 맞으면 그대로 쓰고, 없으면 원문에서 찾는다.
// 그래도 못 찾은 표현이 있으면 줄 전체를 표시해 "표시 위치가 틀린" 화면을 만들지 않는다.
function locate(text: string, findings: AdFinding[]): { ranges: Range[]; unlocated: number } {
  const ranges: Range[] = [];
  let unlocated = 0;
  for (const f of findings) {
    if (f.start !== undefined && f.end !== undefined && text.slice(f.start, f.end) === f.text) {
      ranges.push({ start: f.start, end: f.end, reason: f.reason });
      continue;
    }
    const index = f.text.length > 0 ? text.indexOf(f.text) : -1;
    if (index >= 0) ranges.push({ start: index, end: index + f.text.length, reason: f.reason });
    else unlocated += 1;
  }
  // 겹치는 표시는 앞의 것만 남긴다
  const merged: Range[] = [];
  for (const range of ranges.sort((a, b) => a.start - b.start)) {
    const last = merged.at(-1);
    if (!last || range.start >= last.end) merged.push(range);
  }
  return { ranges: merged, unlocated };
}

export function HighlightedText({ text, findings, action }: { text: string; findings: AdFinding[]; action: AdAction }) {
  const { ranges, unlocated } = locate(text, findings);
  const mark = `${ACTION_TONE[action].mark} rounded px-0.5 text-foreground underline decoration-2 underline-offset-4`;

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) parts.push(text.slice(cursor, range.start));
    parts.push(
      <mark key={range.start} className={mark} title={range.reason}>
        {text.slice(range.start, range.end)}
      </mark>,
    );
    cursor = range.end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));

  if (unlocated === 0) return <p className="text-base leading-relaxed">{parts}</p>;

  return (
    <div>
      <p className="rounded-md border-2 border-dashed px-2 py-1 text-base leading-relaxed">{parts}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        위험 표현 {unlocated}개는 원문에서 위치를 찾지 못해 줄 전체로 표시했습니다
      </p>
    </div>
  );
}
