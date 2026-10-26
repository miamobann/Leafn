// 검토 결과 맨 위의 결론 (두괄식): 판정 개수 · 문제 줄로 바로 가기 · 다음 할 일. 새 검토와 검토 상세에서 같이 쓴다.
// 줄별 내용은 아래 ResultLines 가 문제 줄부터 보여 주므로 여기서는 전체 표를 그리지 않는다 (2026-10-27 UI 정리).
import type { ReactNode } from "react";
import type { AdCheck } from "@/lib/schemas/ad-check";
import { countByAction } from "../_lib/lines";
import { ACTION_TONE, ActionBadge } from "./ad-badges";
import { ACTION_ORDER } from "./result-lines";

export function ResultSummary({ check, next }: { check: AdCheck; /** 다음 할 일 (버튼 · 안내) */ next?: ReactNode }) {
  const lines = check.line_results ?? [];
  const counts = countByAction(lines);
  const problems = lines.filter((l) => l.action !== "ok").toSorted((a, b) => ACTION_ORDER[a.action] - ACTION_ORDER[b.action] || a.line_index - b.line_index);
  const sentence = problems.length === 0 ? `${lines.length}줄 모두 그대로 써도 됩니다.` : `${lines.length}줄 중 ${problems.length}줄을 확인해야 합니다.`;
  const chips = (["must_fix", "expert", "should_fix", "ok"] as const).filter((a) => counts[a] > 0);

  return (
    <section aria-label="결론" className="space-y-3 rounded-lg border bg-muted/40 p-4 text-sm">
      <p className="flex flex-wrap items-center gap-2 text-base font-semibold">
        {check.overall_action && <ActionBadge action={check.overall_action} />}
        {sentence}
      </p>
      <p className="flex flex-wrap gap-1.5">
        {chips.map((a) => (
          <span key={a} className={`rounded px-1.5 py-0.5 text-xs ${ACTION_TONE[a].badge}`}>
            {ACTION_TONE[a].label} {counts[a]}
          </span>
        ))}
      </p>
      {problems.length > 0 && (
        <ol className="space-y-1">
          {problems.map((l) => {
            const words = check.findings.filter((f) => f.line_index === l.line_index).map((f) => `「${f.text}」`);
            return (
              <li key={l.line_index}>
                <a href={`#line-${l.line_index}`} className="flex gap-2 underline-offset-4 hover:underline">
                  <span className="w-8 shrink-0 text-muted-foreground">#{l.line_index}</span>
                  <span className={`shrink-0 rounded px-1.5 text-xs ${ACTION_TONE[l.action].badge}`}>{ACTION_TONE[l.action].label}</span>
                  <span className="truncate" lang="ja">
                    {words.length ? words.join(" ") : l.original}
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      )}
      {next && <div className="border-t pt-3">{next}</div>}
    </section>
  );
}
