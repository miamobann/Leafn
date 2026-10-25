// 검토 결과 맨 위의 결론 (두괄식). 새 검토와 검토 상세에서 같이 쓴다.
import type { AdCheck } from "@/lib/schemas/ad-check";
import { countByAction } from "../_lib/lines";
import { ACTION_TONE, ActionBadge } from "./ad-badges";

export function ResultSummary({ check }: { check: AdCheck }) {
  const lines = check.line_results ?? [];
  const counts = countByAction(lines);
  const toFix = lines.filter((l) => l.action !== "ok");
  const sentence =
    toFix.length === 0
      ? `${lines.length}줄 모두 그대로 써도 됩니다.`
      : `${lines.length}줄 중 ${toFix.length}줄을 확인해야 합니다 (수정 필수 ${counts.must_fix} · 수정 권장 ${counts.should_fix} · 전문가 확인 ${counts.expert}).`;

  return (
    <section aria-label="결론" className="rounded-lg border p-3 text-sm">
      <p className="flex flex-wrap items-center gap-2 text-base font-semibold">
        {check.overall_action && <ActionBadge action={check.overall_action} />}
        {sentence}
      </p>
      {toFix.length > 0 && (
        <ul className="mt-2 space-y-1">
          {toFix.map((l) => (
            <li key={l.line_index}>
              <a href={`#line-${l.line_index}`} className="flex gap-2 hover:underline">
                <span className={`shrink-0 rounded px-1.5 text-xs ${ACTION_TONE[l.action].badge}`}>{ACTION_TONE[l.action].label}</span>
                <span className="truncate">
                  #{l.line_index} {l.original}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
