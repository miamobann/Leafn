// 한 줄(문구 1건)의 판정 카드. 새 검토와 검토 상세에서 같이 쓴다.
// 공용 AdLineResult·AdFinding만 받으므로 리뷰 번역(P5)에서도 그대로 쓸 수 있다.
import { LangBadge } from "@/components/common/badges";
import type { AdFinding, AdLineResult } from "@/lib/schemas/ad-check";
import { basisItems } from "../_lib/basis";
import { ActionBadge } from "./ad-badges";
import { HighlightedText } from "./highlighted-text";

// 근거가 기준 자료로 뒷받침되는지. 담당자가 할 일처럼 읽히지 않게 상태로 쓴다 (실무자 비판 10번)
const BASIS_STATUS_LABEL = { confirmed: "근거 확실", needs_check: "해석이 갈림" } as const;

type LineResultCardProps = {
  line: AdLineResult;
  findings: AdFinding[];
  /** 선택한 대체 표현. onSelect가 없으면 읽기 전용 */
  selectedSuggestion?: string | null;
  onSelect?: (text: string | null) => void;
};

/** 줄마다 맨 위에 보여 줄 결론 한 문장 (두괄식) */
const CONCLUSION: Record<AdLineResult["action"], string> = {
  must_fix: "고쳐야 합니다",
  should_fix: "고치는 것을 권합니다",
  expert: "전문가 확인이 필요합니다",
  ok: "그대로 써도 됩니다",
};

function conclusion(line: AdLineResult, findings: AdFinding[]): string {
  if (line.action === "ok" || findings.length === 0) return `이 줄은 ${CONCLUSION[line.action]}.`;
  return `${findings.map((f) => `「${f.text}」`).join(", ")} 표현을 ${CONCLUSION[line.action]}.`;
}

export function LineResultCard({ line, findings, selectedSuggestion, onSelect }: LineResultCardProps) {
  const rechecks = findings.flatMap((f) => f.suggestion_rechecks ?? []);
  const lang = /[぀-ヿ]/.test(line.original) ? "ja" : "ko";

  return (
    <article id={`line-${line.line_index}`} className="scroll-mt-4 rounded-lg border p-4">
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">#{line.line_index}</span>
        <ActionBadge action={line.action} />
        <LangBadge lang={lang} />
      </header>
      <p className="mb-3 text-sm font-medium">{conclusion(line, findings)}</p>

      <HighlightedText text={line.original} findings={findings} action={line.action} />

      {findings.length > 0 && (
        <section className="mt-4">
          <h3 className="mb-2 text-sm font-semibold">고칠 이유</h3>
          <ul className="space-y-2">
            {findings.map((f) => (
              <li key={f.text} className="rounded-md bg-muted p-3 text-sm">
                <p className="font-medium">「{f.text}」</p>
                <p className="mt-1">{f.reason}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rechecks.length > 0 && (
        <section className="mt-4">
          <h3 className="mb-2 text-sm font-semibold">대체 표현</h3>
          <ul className="space-y-2">
            {rechecks.map((s) => {
              const selected = selectedSuggestion === s.text;
              const selectable = Boolean(onSelect) && s.recheck === "pass";
              return (
                <li key={s.text}>
                  <button
                    type="button"
                    disabled={!selectable}
                    aria-pressed={onSelect ? selected : undefined}
                    // 서버에서 그리는 상세(읽기 전용)에는 이벤트 함수를 넘기지 않는다
                    onClick={onSelect ? () => onSelect(selected ? null : s.text) : undefined}
                    className={`w-full rounded-md border p-3 text-left text-sm ${
                      selected ? "border-foreground bg-muted" : ""
                    } ${selectable ? "hover:bg-muted" : "cursor-default"}`}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium" lang="ja">
                        {s.text}
                      </span>
                      <span
                        className={`rounded px-1.5 text-xs ${
                          s.recheck === "pass" ? "bg-risk-low/15 text-risk-low" : "bg-risk-medium/15 text-risk-medium"
                        }`}
                      >
                        {s.recheck === "pass" ? "재검토 통과" : "재수정 필요"}
                      </span>
                      {selected && <span className="text-xs">선택됨</span>}
                    </span>
                    {s.text_ko && <span className="mt-1 block">한국어: {s.text_ko}</span>}
                    <span className="mt-2 block border-t pt-2 text-xs text-muted-foreground">근거 설명: {s.recheck_reason}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {findings.length > 0 && (
        <section className="mt-4 text-sm">
          <h3 className="mb-1 font-semibold">근거</h3>
          <ul className="space-y-1 text-muted-foreground">
            {findings.map((f) => (
              <li key={f.text}>
                「{f.text}」 {basisItems(f.basis).join(" / ")} · {f.basis_status ? BASIS_STATUS_LABEL[f.basis_status] : BASIS_STATUS_LABEL.needs_check}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 성분 확인 · 현지화는 참고용이라 접어 둔다 (실무자 비판 9번). 고칠 이유 · 대체 표현 · 근거는 항상 보인다 */}
      {(line.ingredient_check || line.translated_text || line.localized_note) && (
        <details className="mt-4 rounded-md border p-3 text-sm">
          <summary className="cursor-pointer font-semibold">성분 확인 · 현지화</summary>
          {/* AI 판정의 문제없음 줄은 내용이 없을 수 있어 빈 제목은 숨긴다 */}
          {line.ingredient_check && (
            <section className="mt-3">
              <h3 className="mb-1 font-semibold">성분 확인</h3>
              <p className="text-muted-foreground">{line.ingredient_check}</p>
            </section>
          )}
          {(line.translated_text || line.localized_note) && (
            <section className="mt-3">
              <h3 className="mb-2 font-semibold">현지화</h3>
              {line.translated_text && (
                <dl className="mb-2 grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1">
                  <dt className="text-muted-foreground">일본어 번역</dt>
                  <dd lang="ja">{line.translated_text}</dd>
                  <dt className="text-muted-foreground">한국어 역번역</dt>
                  <dd>{line.back_translation_ko}</dd>
                </dl>
              )}
              {line.localized_note && <p className="text-muted-foreground">{line.localized_note}</p>}
            </section>
          )}
        </details>
      )}
    </article>
  );
}
