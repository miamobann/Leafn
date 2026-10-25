// 검토 결과 맨 위의 결론 (두괄식) + 「원문 → 추천 대체 표현」 비교표 (실무자 비판 9번). 새 검토와 검토 상세에서 같이 쓴다.
import type { AdCheck } from "@/lib/schemas/ad-check";
import { countByAction } from "../_lib/lines";
import { ACTION_TONE, ActionBadge } from "./ad-badges";

export function ResultSummary({ check }: { check: AdCheck }) {
  const lines = check.line_results ?? [];
  const counts = countByAction(lines);
  const toFix = lines.filter((l) => l.action !== "ok");
  /** 줄마다 위험 표현별로 재검토를 통과한 첫 대체 표현 (없으면 null) */
  const bestFor = (lineIndex: number) =>
    check.findings
      .filter((f) => f.line_index === lineIndex)
      .map((f) => ({ text: f.text, pick: (f.suggestion_rechecks ?? []).find((r) => r.recheck === "pass") ?? null }));
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
      {lines.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="py-1 pr-2 font-medium">#</th>
                <th className="py-1 pr-2 font-medium">판정</th>
                <th className="py-1 pr-2 font-medium">원문</th>
                <th className="py-1 font-medium">추천 대체 표현</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const picks = bestFor(l.line_index);
                return (
                  <tr key={l.line_index} className="border-b align-top last:border-0">
                    <td className="py-2 pr-2">
                      <a href={`#line-${l.line_index}`} className="hover:underline">
                        {l.line_index}
                      </a>
                    </td>
                    <td className="py-2 pr-2">
                      <span className={`rounded px-1.5 text-xs whitespace-nowrap ${ACTION_TONE[l.action].badge}`}>{ACTION_TONE[l.action].label}</span>
                    </td>
                    <td className="py-2 pr-2">{l.original}</td>
                    <td className="py-2">
                      {l.action === "ok" || picks.length === 0 ? (
                        <span className="text-muted-foreground">그대로 사용</span>
                      ) : (
                        <ul className="space-y-1">
                          {picks.map((p) => (
                            <li key={p.text}>
                              <span className="text-muted-foreground">「{p.text}」 → </span>
                              {p.pick ? (
                                <>
                                  <span lang="ja">{p.pick.text}</span>
                                  {p.pick.text_ko && <span className="block text-xs text-muted-foreground">{p.pick.text_ko}</span>}
                                </>
                              ) : (
                                <span className="text-risk-medium">통과한 대체 표현 없음 · 아래 카드 확인</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
