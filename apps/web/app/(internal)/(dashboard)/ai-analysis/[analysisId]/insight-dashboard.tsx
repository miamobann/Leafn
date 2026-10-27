// AI 분석 결과의 대시보드형 화면 (프롬프트 v3부터, 2026-10-26). 시장 분석 · 리뷰 분석 요약 탭과 같은 순서로 읽힌다:
// 인사이트 하나 + 종합 판단 → 관점 카드 → 타깃 고객(v4, 설문 참고) → 이번 분석으로 알 수 있는 것 → 할 일 · 반대 근거 · 빠진 근거
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import type { AiAnalysisResult } from "@/lib/schemas/ai-analysis";
import { SUBMISSION_TAB_LABELS } from "@/lib/schemas/submission";
import { Basis } from "./basis";
import { CONFIDENCE, dueText, gapText, LEARNING_KIND, SURVEY_REFERENCE_NOTE, VERDICT, VERDICT_ADJUSTED } from "./labels";

/** today: 마감일 옆 D-n 계산용 (YYYY-MM-DD) */
export function InsightDashboard({ result, refOf, today }: { result: AiAnalysisResult; refOf: Record<string, string>; today?: string }) {
  const { insight, verdict, learnings = [], counterpoint, target } = result;

  return (
    <div className="space-y-6">
      {/* 인사이트 하나 + 종합 판단 */}
      <section className="grid gap-4 rounded-xl border bg-card p-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">마케터 인사이트</p>
          <p className="text-xl leading-snug font-semibold break-keep">
            {insight?.text ?? result.summary}
            {insight && <Basis point={insight} refOf={refOf} />}
          </p>
          {insight?.story && <p className="text-sm leading-relaxed break-keep text-muted-foreground">{insight.story}</p>}
        </div>
        {verdict && (
          <div className="space-y-2 rounded-lg bg-muted px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">종합 판단</p>
            <span className={`inline-flex rounded px-2 py-0.5 text-sm font-semibold ${VERDICT[verdict.level].className}`}>{VERDICT[verdict.level].label}</span>
            <p className="text-sm leading-relaxed break-keep">
              {verdict.reason}
              <Basis point={verdict} refOf={refOf} />
            </p>
            {verdict.adjusted_from && <p className="text-xs text-status-pending">{VERDICT_ADJUSTED}</p>}
          </div>
        )}
      </section>

      {/* 관점 카드 (프롬프트 #분석 관점 하나 = 카드 하나) */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {result.sections.map((s) => (
          <Card key={s.key}>
            <CardContent className="flex h-full flex-col gap-1.5">
              <p className="flex justify-between gap-2 text-xs font-medium text-muted-foreground">
                <span>{s.title}</span>
                {s.confidence && <span className="font-normal">{CONFIDENCE[s.confidence]}</span>}
              </p>
              <p className="text-xl leading-snug font-semibold break-keep">{s.value || "근거 없음"}</p>
              {s.meaning && <p className="text-sm leading-relaxed break-keep">{s.meaning}</p>}
              {s.points.length > 0 && (
                <ul className="mt-auto space-y-1 border-t pt-2 text-xs leading-relaxed text-muted-foreground">
                  {s.points.map((p, i) => (
                    <li key={i} className="break-keep">
                      {p.text}
                      <Basis point={p} refOf={refOf} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 타깃 고객: 설문 요약(결재 전 참고 데이터)으로 본 "누구에게" (v4) */}
      {target && (
        <Card className="border-dashed">
          <CardContent className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <div className="space-y-1.5">
              <p className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                <span>타깃 고객</span>
                <span className="rounded-full border px-2 py-0.5 font-normal">{SURVEY_REFERENCE_NOTE}</span>
              </p>
              <p className="text-xl leading-snug font-semibold break-keep">{target.value}</p>
              {target.meaning && <p className="text-sm leading-relaxed break-keep">{target.meaning}</p>}
              <p className="text-xs text-muted-foreground">
                <Link href="/survey-results" className="underline-offset-4 hover:underline">
                  소비자 설문 {target.respondents}명{target.period && ` · ${target.period.from} ~ ${target.period.to}`}
                </Link>
                {" · 워크스페이스 전체 응답"}
              </p>
            </div>
            {target.points.length > 0 && (
              <ul className="space-y-1 self-center text-sm leading-relaxed text-muted-foreground md:border-l md:pl-4">
                {target.points.map((p, i) => (
                  <li key={i} className="break-keep">
                    {p.text}
                    <Basis point={p} refOf={refOf} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {learnings.length > 0 && (
        <section className="space-y-3 rounded-xl bg-muted px-6 py-5">
          <h2 className="font-semibold">이번 분석으로 알 수 있는 것</h2>
          <ul className="space-y-4">
            {learnings.map((l, i) => (
              <li key={i} className="grid gap-x-3 gap-y-1 sm:grid-cols-[7.5rem_minmax(0,1fr)]">
                <span className="flex flex-col items-start gap-1">
                  <span className="inline-flex rounded-full border bg-background px-2.5 py-0.5 text-xs font-medium whitespace-nowrap">{l.label}</span>
                  <span className={`text-xs ${LEARNING_KIND[l.kind].className}`}>{LEARNING_KIND[l.kind].label}</span>
                </span>
                <div className="min-w-0 space-y-0.5">
                  <p className="leading-relaxed font-semibold break-keep">
                    {l.text}
                    <Basis point={l} refOf={refOf} />
                  </p>
                  {l.action && <p className="text-sm leading-relaxed break-keep text-muted-foreground">할 일: {l.action}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardContent className="space-y-3">
            <h2 className="font-semibold">할 일</h2>
            <ol className="space-y-3 text-sm">
              {result.actions.map((a, i) => (
                <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
                  <span className="mt-0.5 self-start rounded border px-1 text-xs whitespace-nowrap">우선 {a.priority}</span>
                  <div className="min-w-0">
                    <p className="break-keep">
                      <span className="mr-1 text-muted-foreground">[{SUBMISSION_TAB_LABELS[a.tab]}]</span>
                      {a.text}
                      <Basis point={a} refOf={refOf} />
                    </p>
                    {a.done_when && <p className="text-xs text-muted-foreground">완료 기준: {a.done_when}</p>}
                    {(a.due_date || a.event) && (
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                        {a.due_date && <span className="rounded bg-muted px-1.5 py-0.5 font-medium">마감 {dueText(a.due_date, today)}</span>}
                        {a.event && (
                          <Link href="/calendar" className="text-muted-foreground underline-offset-4 hover:underline">
                            📅 {a.event.title} ({a.event.start.slice(5).replace("-", "/")}~){!a.event.confirmed && " · 예상 일정"}
                          </Link>
                        )}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {counterpoint && (
            <Card>
              <CardContent className="space-y-1.5">
                <h2 className="font-semibold">반대 근거</h2>
                <p className="text-sm leading-relaxed break-keep">
                  {counterpoint.text}
                  <Basis point={counterpoint} refOf={refOf} />
                </p>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="space-y-1.5">
              <h2 className="font-semibold">빠진 근거</h2>
              {result.data_gaps.length ? (
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {result.data_gaps.map((g, i) => (
                    <li key={i} className="break-keep">
                      {gapText(g)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">없음</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
