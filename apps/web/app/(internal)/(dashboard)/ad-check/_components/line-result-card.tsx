// 한 줄(문구 1건)의 판정 카드. 새 검토와 검토 상세에서 같이 쓴다.
// 공용 AdLineResult·AdFinding만 받으므로 리뷰 번역(P5)에서도 그대로 쓸 수 있다.
import { LangBadge } from "@/components/common/badges";
import type { AdFinding, AdLineResult } from "@/lib/schemas/ad-check";
import { ActionBadge } from "./ad-badges";
import { HighlightedText } from "./highlighted-text";

const BASIS_STATUS_LABEL = { confirmed: "자료 확인됨", needs_check: "자료 확인 필요" } as const;

type LineResultCardProps = {
  line: AdLineResult;
  findings: AdFinding[];
  /** 샘플 판정의 기준 제품이 선택한 제품과 다를 때 보여줄 제품 이름 */
  mismatchProductName?: string | null;
  /** 선택한 대체 표현. onSelect가 없으면 읽기 전용 */
  selectedSuggestion?: string | null;
  onSelect?: (text: string | null) => void;
};

export function LineResultCard({ line, findings, mismatchProductName, selectedSuggestion, onSelect }: LineResultCardProps) {
  const rechecks = findings.flatMap((f) => f.suggestion_rechecks ?? []);
  const lang = /[぀-ヿ]/.test(line.original) ? "ja" : "ko";

  return (
    <article className="rounded-lg border p-4">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">#{line.line_index}</span>
        <ActionBadge action={line.action} />
        <LangBadge lang={lang} />
      </header>

      <HighlightedText text={line.original} findings={findings} action={line.action} />
      {mismatchProductName && (
        <p className="mt-2 text-xs text-muted-foreground">이 샘플 판정은 「{mismatchProductName}」 기준입니다</p>
      )}

      {findings.length > 0 && (
        <section className="mt-4">
          <h3 className="mb-2 text-sm font-semibold">위험 표현과 사유</h3>
          <ul className="space-y-2">
            {findings.map((f) => (
              <li key={f.text} className="rounded-md bg-muted p-3 text-sm">
                <p className="font-medium">「{f.text}」</p>
                <p className="mt-1">{f.reason}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  근거: {f.basis} · {f.basis_status ? BASIS_STATUS_LABEL[f.basis_status] : "자료 확인 필요"}
                </p>
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
                      <span className="font-medium">{s.text}</span>
                      <span
                        className={`rounded px-1.5 text-xs ${
                          s.recheck === "pass" ? "bg-risk-low/15 text-risk-low" : "bg-risk-medium/15 text-risk-medium"
                        }`}
                      >
                        {s.recheck === "pass" ? "✓ 재검토 통과" : "! 재수정 필요"}
                      </span>
                      {selected && <span className="text-xs">선택됨</span>}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">{s.recheck_reason}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-4 text-sm">
        <h3 className="mb-1 font-semibold">성분 확인</h3>
        <p className="text-muted-foreground">{line.ingredient_check}</p>
      </section>

      <section className="mt-4 text-sm">
        <h3 className="mb-2 font-semibold">현지화</h3>
        {line.translated_text && (
          <dl className="mb-2 grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1">
            <dt className="text-muted-foreground">일본어 번역</dt>
            <dd lang="ja">{line.translated_text}</dd>
            <dt className="text-muted-foreground">한국어 역번역</dt>
            <dd>{line.back_translation_ko}</dd>
          </dl>
        )}
        <p className="text-muted-foreground">{line.localized_note}</p>
      </section>
    </article>
  );
}
