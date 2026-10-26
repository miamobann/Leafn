// AI 분석 결과 (docs/team-approval-ai-analysis.md 3장 6, 8장 보완 8, 10장).
// 팀장 확인 전이면 라벨을 달고, 판단마다 근거 버전(결재함 미리보기)으로 가는 링크를 둔다.
// 프롬프트 v2의 칸(종합 판단 · 확신도 · 같은 결론 · 반론 · 완료 기준)은 v1 결과에는 없으니 있을 때만 보인다
import Link from "next/link";
import { notFound } from "next/navigation";
import { AiResultMeta } from "@/components/common/ai";
import { AiCheckBadge } from "@/components/common/submission-badges";
import { PageHeader } from "@/components/layout/page-header";
import { getMemberName } from "@/lib/data";
import { getAiAnalysis, getMyTabs, getVersionsByIds } from "@/lib/data/submissions";
import { isSupabaseConfigured } from "@/lib/data/workspace";
import { formatDate } from "@/lib/format";
import type { AiAnalysisPoint, AiConfidence, AiDataGap, AiVerdictLevel } from "@/lib/schemas/ai-analysis";
import { SUBMISSION_TAB_LABELS } from "@/lib/schemas/submission";
import { LeadCheckButton } from "./lead-check-button";

const TEXT = {
  back: "← AI 분석",
  notice: "AI가 팀장이 승인한 탭별 결론만 근거로 정리한 결과예요. 팀장 확인 전에는 참고로만 쓰세요.",
  checked: (name: string, date: string) => `${name} · ${date} 확인`,
  summary: "결론",
  verdict: "종합 판단",
  verdictAdjusted: "AI는 '지금 진행'을 골랐지만, 미해결 광고 위험이 있거나 승인 탭이 2개 미만이라 '보완 후 진행'으로 낮췄어요.",
  agreements: "여러 탭이 같이 가리키는 결론",
  counterpoint: "반대 근거",
  conflicts: "탭끼리 어긋나는 점",
  checkFirst: (tab: string) => `먼저 확인: ${tab}`,
  doneWhen: (text: string) => `완료 기준: ${text}`,
  gaps: "빠진 근거",
  actions: "할 일",
  inputs: "입력한 승인본",
  needsCheck: "근거 확인 필요",
  noPoints: "이 관점의 근거가 되는 승인본이 없어요.",
  none: "없음",
  priority: (n: number) => `우선 ${n}`,
};

const VERDICT: Record<AiVerdictLevel, { label: string; className: string }> = {
  go: { label: "지금 진행", className: "bg-status-approved/15 text-status-approved" },
  fix_first: { label: "보완 후 진행", className: "bg-status-pending/15 text-status-pending" },
  hold: { label: "보류", className: "bg-status-rejected/15 text-status-rejected" },
};

const CONFIDENCE: Record<AiConfidence, string> = { high: "확신 높음", medium: "확신 보통", low: "확신 낮음" };

const gapText = (g: AiDataGap) => (typeof g === "string" ? g : `[${SUBMISSION_TAB_LABELS[g.tab]}] ${g.text}`);

export default async function AiAnalysisDetailPage({ params }: { params: Promise<{ analysisId: string }> }) {
  const analysis = await getAiAnalysis((await params).analysisId);
  if (!analysis) notFound();
  const [inputs, my, checkedBy, createdBy] = await Promise.all([
    getVersionsByIds(analysis.input_version_ids),
    getMyTabs(),
    getMemberName(analysis.lead_checked_by),
    getMemberName(analysis.created_by),
  ]);
  const refOf = new Map(inputs.map(({ version, submission }) => [version.id, `${SUBMISSION_TAB_LABELS[submission.tab]} v${version.version_no}`]));
  const { result } = analysis;
  const checked = analysis.lead_checked_at !== null;

  const Basis = ({ point }: { point: AiAnalysisPoint }) => (
    <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
      {point.basis.map((id) => (
        <Link key={id} href={`/approvals/${id}`} className="rounded border px-1 text-xs text-muted-foreground hover:text-foreground">
          {refOf.get(id) ?? "?"}
        </Link>
      ))}
      {point.needs_check && <span className="rounded bg-status-pending/15 px-1 text-xs text-status-pending">{TEXT.needsCheck}</span>}
    </span>
  );
  type ShownPoint = AiAnalysisPoint & { confidence?: AiConfidence; check_first?: keyof typeof SUBMISSION_TAB_LABELS };
  const Points = ({ points }: { points: ShownPoint[] }) =>
    points.length === 0 ? (
      <p className="text-sm text-muted-foreground">{TEXT.noPoints}</p>
    ) : (
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {points.map((p, i) => (
          <li key={i}>
            {p.text}
            {p.confidence && <span className="ml-1 rounded border px-1 text-xs text-muted-foreground">{CONFIDENCE[p.confidence]}</span>}
            {p.check_first && <span className="ml-1 text-xs text-muted-foreground">{TEXT.checkFirst(SUBMISSION_TAB_LABELS[p.check_first])}</span>}
            <Basis point={p} />
          </li>
        ))}
      </ul>
    );

  return (
    <>
      <Link href="/ai-analysis" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        {TEXT.back}
      </Link>
      <PageHeader title={analysis.title} featureId="N" />

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 text-sm">
        <AiCheckBadge checked={checked} />
        {checked ? (
          <span className="text-muted-foreground">{TEXT.checked(checkedBy, formatDate(analysis.lead_checked_at ?? ""))}</span>
        ) : (
          <span className="text-muted-foreground">{TEXT.notice}</span>
        )}
        {!checked && my.role === "owner" && isSupabaseConfigured() && <LeadCheckButton analysisId={analysis.id} />}
      </div>

      <div className="space-y-6">
        <section className="space-y-2">
          <h2 className="font-semibold">{TEXT.summary}</h2>
          <p className="text-sm">{result.summary}</p>
        </section>

        {result.verdict && (
          <section className="space-y-2">
            <h2 className="font-semibold">{TEXT.verdict}</h2>
            <p className="text-sm">
              <span className={`mr-2 rounded px-1.5 py-0.5 text-xs font-medium ${VERDICT[result.verdict.level].className}`}>
                {VERDICT[result.verdict.level].label}
              </span>
              {result.verdict.reason}
              <Basis point={{ text: result.verdict.reason, basis: result.verdict.basis, needs_check: result.verdict.needs_check }} />
            </p>
            {result.verdict.adjusted_from && <p className="text-xs text-status-pending">{TEXT.verdictAdjusted}</p>}
          </section>
        )}

        {result.sections.map((s) => (
          <section key={s.key} className="space-y-2">
            <h2 className="font-semibold">{s.title}</h2>
            <Points points={s.points} />
          </section>
        ))}

        {result.agreements && (
          <section className="space-y-2">
            <h2 className="font-semibold">{TEXT.agreements}</h2>
            {result.agreements.length ? <Points points={result.agreements} /> : <p className="text-sm text-muted-foreground">{TEXT.none}</p>}
          </section>
        )}

        <section className="space-y-2">
          <h2 className="font-semibold">{TEXT.conflicts}</h2>
          {result.conflicts.length ? <Points points={result.conflicts} /> : <p className="text-sm text-muted-foreground">{TEXT.none}</p>}
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold">{TEXT.gaps}</h2>
          {result.data_gaps.length ? (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {result.data_gaps.map((g, i) => (
                <li key={i}>{gapText(g)}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{TEXT.none}</p>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold">{TEXT.actions}</h2>
          <ol className="space-y-1 text-sm">
            {result.actions.map((a, i) => (
              <li key={i}>
                <span className="mr-2 rounded border px-1 text-xs">{TEXT.priority(a.priority)}</span>
                <span className="mr-1 text-muted-foreground">[{SUBMISSION_TAB_LABELS[a.tab]}]</span>
                {a.text}
                <Basis point={a} />
                {a.done_when && <p className="mt-0.5 pl-1 text-xs text-muted-foreground">{TEXT.doneWhen(a.done_when)}</p>}
              </li>
            ))}
          </ol>
        </section>

        {result.counterpoint && (
          <section className="space-y-2">
            <h2 className="font-semibold">{TEXT.counterpoint}</h2>
            <p className="text-sm">
              {result.counterpoint.text}
              <Basis point={result.counterpoint} />
            </p>
          </section>
        )}

        <section className="space-y-2">
          <h2 className="font-semibold">{TEXT.inputs}</h2>
          <ul className="space-y-1 text-sm">
            {inputs.map(({ version, submission }) => (
              <li key={version.id}>
                <Link href={`/approvals/${version.id}`} className="underline-offset-4 hover:underline">
                  {SUBMISSION_TAB_LABELS[submission.tab]} v{version.version_no}
                </Link>
                <span className="text-muted-foreground">
                  {" "}
                  · {version.summary}
                  {version.data_as_of && ` · 기준 ${formatDate(version.data_as_of)}`}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <p className="text-xs text-muted-foreground">실행 {createdBy}</p>
        <AiResultMeta model={analysis.model} promptVersion={analysis.prompt_version} createdAt={analysis.created_at} />
      </div>
    </>
  );
}
