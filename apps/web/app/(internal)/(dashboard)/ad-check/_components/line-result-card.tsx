// 한 줄(문구 1건)의 판정 카드. 결과 패널과 이력에서 같이 쓴다.
// TAB 3 전용 지식 없이 LineResult만 받으므로, 리뷰 번역(P5)에서도 그대로 쓸 수 있다.
import { ActionBadge, LangBadge } from "./badges";
import { HighlightedText } from "./highlighted-text";
import type { LineResult } from "../_lib/types";

type LineResultCardProps = {
  line: LineResult;
  /** 샘플 판정의 기준 제품이 선택한 제품과 다를 때 보여줄 제품 이름 */
  mismatchProductName?: string | null;
  /** 선택한 대체 표현. onSelect가 없으면 읽기 전용 */
  selectedSuggestion?: string | null;
  onSelect?: (text: string | null) => void;
};

export function LineResultCard({ line, mismatchProductName, selectedSuggestion, onSelect }: LineResultCardProps) {
  return (
    <article className="rounded-lg border border-border p-4">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">#{line.lineIndex}</span>
        <ActionBadge action={line.action} />
        <LangBadge lang={line.inputLang} />
        {line.sampleId && <span className="text-xs text-muted">샘플 {line.sampleId}</span>}
      </header>

      <HighlightedText text={line.original} findings={line.findings} action={line.action} />

      {mismatchProductName && (
        <p className="mt-2 text-xs text-muted">이 샘플 판정은 「{mismatchProductName}」 기준입니다</p>
      )}

      {line.findings.length > 0 && (
        <section className="mt-4">
          <h3 className="mb-2 text-sm font-semibold">위험 표현과 사유</h3>
          <ul className="flex flex-col gap-2">
            {line.findings.map((f) => (
              <li key={f.text} className="rounded-md bg-sidebar p-3 text-sm">
                <p className="font-medium">「{f.text}」</p>
                <p className="mt-1">{f.reason}</p>
                <p className="mt-1 text-xs text-muted">
                  근거: {f.basis} · <span className="font-medium">{f.basisStatus}</span>
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-4 text-sm">
        <h3 className="mb-1 font-semibold">성분 확인</h3>
        <p className="text-muted">{line.ingredientCheck}</p>
      </section>

      {line.suggestions.length > 0 && (
        <section className="mt-4">
          <h3 className="mb-2 text-sm font-semibold">대체 표현</h3>
          <ul className="flex flex-col gap-2">
            {line.suggestions.map((s) => {
              const selected = selectedSuggestion === s.text;
              const selectable = Boolean(onSelect) && s.recheck === "통과";
              return (
                <li key={s.text}>
                  <button
                    type="button"
                    disabled={!selectable}
                    aria-pressed={onSelect ? selected : undefined}
                    // 서버에서 그리는 이력(읽기 전용)에는 이벤트 함수를 넘기지 않는다
                    onClick={onSelect ? () => onSelect(selected ? null : s.text) : undefined}
                    className={`w-full rounded-md border p-3 text-left text-sm ${
                      selected ? "border-foreground bg-sidebar-accent" : "border-border"
                    } ${selectable ? "hover:bg-sidebar" : "cursor-default"}`}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{s.text}</span>
                      <span
                        className={`rounded border px-1.5 text-xs ${
                          s.recheck === "통과"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                            : "border-amber-300 bg-amber-50 text-amber-800"
                        }`}
                      >
                        {s.recheck === "통과" ? "✓ 재검토 통과" : "! 재수정 필요"}
                      </span>
                      {selected && <span className="text-xs">선택됨</span>}
                    </span>
                    <span className="mt-1 block text-xs text-muted">{s.recheckReason}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-4 text-sm">
        <h3 className="mb-2 font-semibold">현지화</h3>
        {line.translatedText && (
          <dl className="mb-2 grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1">
            <dt className="text-muted">일본어 번역</dt>
            <dd lang="ja">{line.translatedText}</dd>
            <dt className="text-muted">한국어 역번역</dt>
            <dd>{line.backTranslationKo}</dd>
          </dl>
        )}
        <p className="text-muted">{line.localizedNote}</p>
      </section>
    </article>
  );
}
