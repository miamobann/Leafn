// AI 분석 결과 (docs/team-approval-ai-analysis.md 3장 6, 8장 보완 8, 10장).
// 팀장 확인 전이면 라벨을 달고, 판단마다 근거 버전(결재함 미리보기)으로 가는 링크를 둔다
import Link from "next/link";
import { notFound } from "next/navigation";
import { AiResultMeta } from "@/components/common/ai";
import { AiCheckBadge } from "@/components/common/submission-badges";
import { PageHeader } from "@/components/layout/page-header";
import { getMemberName } from "@/lib/data";
import { getAiAnalysis, getMyTabs, getVersionsByIds } from "@/lib/data/submissions";
import { isSupabaseConfigured } from "@/lib/data/workspace";
import { formatDate } from "@/lib/format";
import type { AiAnalysisPoint } from "@/lib/schemas/ai-analysis";
import { SUBMISSION_TAB_LABELS } from "@/lib/schemas/submission";
import { LeadCheckButton } from "./lead-check-button";

const TEXT = {
  back: "← AI 분석",
  notice: "AI가 팀장이 승인한 탭별 결론만 근거로 정리한 결과예요. 팀장 확인 전에는 참고로만 쓰세요.",
  checked: (name: string, date: string) => `${name} · ${date} 확인`,
  summary: "결론",
  conflicts: "탭끼리 어긋나는 점",
  gaps: "빠진 근거",
  actions: "할 일",
  inputs: "입력한 승인본",
  needsCheck: "근거 확인 필요",
  noPoints: "이 관점의 근거가 되는 승인본이 없어요.",
  none: "없음",
  priority: (n: number) => `우선 ${n}`,
};

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
  const Points = ({ points }: { points: AiAnalysisPoint[] }) =>
    points.length === 0 ? (
      <p className="text-sm text-muted-foreground">{TEXT.noPoints}</p>
    ) : (
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {points.map((p, i) => (
          <li key={i}>
            {p.text}
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

        {result.sections.map((s) => (
          <section key={s.key} className="space-y-2">
            <h2 className="font-semibold">{s.title}</h2>
            <Points points={s.points} />
          </section>
        ))}

        <section className="space-y-2">
          <h2 className="font-semibold">{TEXT.conflicts}</h2>
          {result.conflicts.length ? <Points points={result.conflicts} /> : <p className="text-sm text-muted-foreground">{TEXT.none}</p>}
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold">{TEXT.gaps}</h2>
          {result.data_gaps.length ? (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {result.data_gaps.map((g) => (
                <li key={g}>{g}</li>
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
              </li>
            ))}
          </ol>
        </section>

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
