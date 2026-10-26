// 줄별 판정 목록: 문제 있는 줄(고쳐야 함 → 전문가 확인 → 수정 권장)을 위에, 문제 없는 줄은 「문제 없는 줄 N개 보기」에 접는다 (2026-10-27 UI 정리).
// 새 검토 · 검토 상세 · 가이드에 반영 칸이 같이 쓴다. onSelect 가 없으면 읽기 전용 (서버에서 그려도 된다).
import type { AdAction, AdFinding, AdLineResult } from "@/lib/schemas/ad-check";
import { LineResultCard } from "./line-result-card";

/** 위에 둘 순서: 무거운 판정부터 */
export const ACTION_ORDER: Record<AdAction, number> = { must_fix: 0, expert: 1, should_fix: 2, ok: 3 };

export function ResultLines({
  lines,
  findings,
  selected,
  onSelect,
}: {
  lines: AdLineResult[];
  findings: AdFinding[];
  /** 줄 번호 → 고른 대체 표현 */
  selected?: Record<number, string>;
  onSelect?: (lineIndex: number, suggestion: string | null) => void;
}) {
  const problems = lines.filter((l) => l.action !== "ok").toSorted((a, b) => ACTION_ORDER[a.action] - ACTION_ORDER[b.action] || a.line_index - b.line_index);
  const fine = lines.filter((l) => l.action === "ok");
  return (
    <div className="space-y-3">
      {problems.map((line) => (
        <LineResultCard
          key={line.line_index}
          line={line}
          findings={findings.filter((f) => f.line_index === line.line_index)}
          selectedSuggestion={selected?.[line.line_index] ?? null}
          onSelect={onSelect ? (s) => onSelect(line.line_index, s) : undefined}
        />
      ))}
      {fine.length > 0 && (
        <details className="rounded-lg border p-3 text-sm" open={problems.length === 0}>
          <summary className="cursor-pointer font-medium">
            문제 없는 줄 {fine.length}개 {problems.length === 0 ? "" : "보기"}
          </summary>
          <ol className="mt-2 space-y-1">
            {fine.map((line) => (
              <li key={line.line_index} id={`line-${line.line_index}`} className="flex gap-2 scroll-mt-4">
                <span className="w-8 shrink-0 text-muted-foreground">#{line.line_index}</span>
                <span className="whitespace-pre-line" lang={/[぀-ヿ]/.test(line.original) ? "ja" : "ko"}>
                  {line.original}
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
