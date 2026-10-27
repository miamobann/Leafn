// AI 분석 PDF 보고서 (브라우저 인쇄 → 「PDF로 저장」, A4 세로). 화면에서는 숨기고 인쇄할 때만 보인다.
// 대시보드 레이아웃(사이드바 · 헤더)은 공용 영역이라 고치지 않고, 인쇄할 때만 보고서 밖을 숨긴다 (content-guide-report.tsx와 같은 방식).
// 근거는 링크 대신 「리뷰 분석 v2」 같은 글자로 적는다. 모델명 같은 개발 정보는 맨 끝 한 줄에만 둔다.
import type { ReactNode } from "react";
import type { AiAnalysisPoint, AiAnalysisResult } from "@/lib/schemas/ai-analysis";
import { SUBMISSION_TAB_LABELS } from "@/lib/schemas/submission";
import { CONFIDENCE, gapText, LEARNING_KIND, VERDICT, VERDICT_ADJUSTED } from "./labels";

const PRINT_CSS = `
@page { size: A4 portrait; margin: 14mm 12mm; }
@media print {
  body *:not(:has(.analysis-report)):not(.analysis-report):not(.analysis-report *) { display: none !important; }
  *:has(.analysis-report) { display: block !important; position: static !important; overflow: visible !important; height: auto !important; min-height: 0 !important; max-height: none !important; margin: 0 !important; padding: 0 !important; border: 0 !important; box-shadow: none !important; }
  .analysis-report { font-family: var(--font-noto-kr), "Noto Sans KR", "Malgun Gothic", "맑은 고딕", "Apple SD Gothic Neo", "Noto Sans JP", "Yu Gothic", "Hiragino Sans", sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .analysis-report .keep { break-inside: avoid; }
}
`;

export type AnalysisReportProps = {
  title: string;
  result: AiAnalysisResult;
  refOf: Record<string, string>;
  /** 입력한 승인본 한 줄씩: 「리뷰 분석 v2 · 한 줄 결론 · 기준 날짜」 */
  inputs: { ref: string; summary: string; dataAsOf: string | null }[];
  createdAt: string;
  createdBy: string;
  checkedLabel: string;
  meta: string;
};

function Refs({ point, refOf }: { point: Pick<AiAnalysisPoint, "basis" | "needs_check">; refOf: Record<string, string> }) {
  const names = point.basis.map((id) => refOf[id] ?? "?");
  if (names.length === 0 && !point.needs_check) return null;
  return <span className="ml-1 text-[8pt] text-muted-foreground">({[...names, ...(point.needs_check ? ["근거 확인 필요"] : [])].join(" · ")})</span>;
}

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="keep space-y-2">
      <h2 className="flex items-center gap-2 border-b border-foreground pb-1 text-[12pt] font-bold">
        <span className="flex size-5 items-center justify-center rounded-full bg-foreground text-[8pt] text-background">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function AnalysisReport({ title, result, refOf, inputs, createdAt, createdBy, checkedLabel, meta }: AnalysisReportProps) {
  const { insight, verdict, learnings = [], counterpoint } = result;
  let n = 0;
  return (
    <div className="analysis-report hidden space-y-5 bg-background text-[9.5pt] leading-relaxed text-foreground print:block">
      <style>{PRINT_CSS}</style>

      <header className="keep space-y-1 border-b-2 border-foreground pb-2">
        <p className="text-[8.5pt] text-muted-foreground">통합 AI 분석 보고서 · {checkedLabel}</p>
        <h1 className="text-[18pt] font-bold">{title}</h1>
        <p className="text-[8.5pt] text-muted-foreground">
          실행 {createdBy} · {createdAt} · 입력 승인본 {inputs.map((i) => i.ref).join(", ")}
        </p>
      </header>

      <section className="keep grid grid-cols-[minmax(0,1fr)_52mm] gap-4">
        <div className="space-y-1">
          <p className="text-[8.5pt] font-medium text-muted-foreground">마케터 인사이트</p>
          <p className="text-[13pt] leading-snug font-bold">
            {insight?.text ?? result.summary}
            {insight && <Refs point={insight} refOf={refOf} />}
          </p>
          {insight?.story && <p className="text-muted-foreground">{insight.story}</p>}
        </div>
        {verdict && (
          <div className="space-y-1 rounded-md bg-muted p-3">
            <p className="text-[8.5pt] font-medium text-muted-foreground">종합 판단</p>
            <span className={`inline-flex rounded px-1.5 py-0.5 font-semibold ${VERDICT[verdict.level].className}`}>{VERDICT[verdict.level].label}</span>
            <p>
              {verdict.reason}
              <Refs point={verdict} refOf={refOf} />
            </p>
            {verdict.adjusted_from && <p className="text-[8pt] text-status-pending">{VERDICT_ADJUSTED}</p>}
          </div>
        )}
      </section>

      <Section n={++n} title="관점별 진단">
        <div className="grid grid-cols-2 gap-3">
          {result.sections.map((s) => (
            <div key={s.key} className="keep space-y-1 rounded-md border p-3">
              <p className="flex justify-between text-[8.5pt] font-medium text-muted-foreground">
                <span>{s.title}</span>
                {s.confidence && <span className="font-normal">{CONFIDENCE[s.confidence]}</span>}
              </p>
              {s.value && <p className="text-[12pt] font-bold">{s.value}</p>}
              {s.meaning && <p>{s.meaning}</p>}
              <ul className="list-disc space-y-0.5 pl-4 text-[8.5pt] text-muted-foreground">
                {s.points.map((p, i) => (
                  <li key={i}>
                    {p.text}
                    <Refs point={p} refOf={refOf} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {learnings.length > 0 && (
        <Section n={++n} title="이번 분석으로 알 수 있는 것">
          <table className="w-full border-collapse">
            <tbody>
              {learnings.map((l, i) => (
                <tr key={i} className="keep border-b align-top last:border-0">
                  <td className="w-[28mm] py-1.5 pr-2">
                    <span className="block font-semibold">{l.label}</span>
                    <span className={`text-[8pt] ${LEARNING_KIND[l.kind].className}`}>{LEARNING_KIND[l.kind].label}</span>
                  </td>
                  <td className="py-1.5">
                    <p className="font-semibold">
                      {l.text}
                      <Refs point={l} refOf={refOf} />
                    </p>
                    {l.action && <p className="text-muted-foreground">할 일: {l.action}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      <Section n={++n} title="할 일">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b text-left text-[8.5pt] text-muted-foreground">
              <th className="w-[12mm] py-1 font-medium">우선</th>
              <th className="w-[20mm] py-1 font-medium">담당 탭</th>
              <th className="py-1 font-medium">할 일</th>
              <th className="w-[55mm] py-1 font-medium">완료 기준</th>
            </tr>
          </thead>
          <tbody>
            {result.actions.map((a, i) => (
              <tr key={i} className="keep border-b align-top last:border-0">
                <td className="py-1.5">{a.priority}</td>
                <td className="py-1.5">{SUBMISSION_TAB_LABELS[a.tab]}</td>
                <td className="py-1.5 pr-2">
                  {a.text}
                  <Refs point={a} refOf={refOf} />
                </td>
                <td className="py-1.5 text-muted-foreground">{a.done_when ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section n={++n} title="반대 근거 · 빠진 근거">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-[8.5pt] font-medium text-muted-foreground">반대 근거</p>
            <p>
              {counterpoint?.text ?? "-"}
              {counterpoint && <Refs point={counterpoint} refOf={refOf} />}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[8.5pt] font-medium text-muted-foreground">빠진 근거</p>
            {result.data_gaps.length ? (
              <ul className="list-disc space-y-0.5 pl-4">
                {result.data_gaps.map((g, i) => (
                  <li key={i}>{gapText(g)}</li>
                ))}
              </ul>
            ) : (
              <p>없음</p>
            )}
          </div>
        </div>
      </Section>

      <Section n={++n} title="입력한 승인본">
        <ul className="space-y-0.5">
          {inputs.map((i) => (
            <li key={i.ref}>
              <b>{i.ref}</b> · {i.summary}
              {i.dataAsOf && <span className="text-muted-foreground"> · 기준 {i.dataAsOf}</span>}
            </li>
          ))}
        </ul>
      </Section>

      <footer className="keep border-t pt-1 text-[7.5pt] text-muted-foreground">
        AI가 팀장이 승인한 탭별 결론만 근거로 정리한 결과입니다. 최종 판단은 팀장이 합니다. · {meta}
      </footer>
    </div>
  );
}
