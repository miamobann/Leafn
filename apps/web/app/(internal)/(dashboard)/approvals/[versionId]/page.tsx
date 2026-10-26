// 버전 미리보기 (docs/team-approval-ai-analysis.md 3장 3, 7장 3단계): 내용 · 근거 · 앞 버전과의 차이를 보고 팀장이 승인 · 반려한다.
// 팀장은 모든 버전을, 팀원은 자기가 만든 버전과 승인본(AI 분석 근거)만 본다 (2026-10-26 총괄 결정. DB도 같은 규칙으로 막는다)
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReviewStateBadge } from "@/app/(internal)/(dashboard)/ad-check/_components/ad-badges";
import { SubmissionBody } from "@/components/common/submission-body";
import { VersionStatusBadge } from "@/components/common/submission-badges";
import { PageHeader } from "@/components/layout/page-header";
import { DetailTemplate } from "@/components/templates";
import { getAdChecks } from "@/lib/data";
import { getMyTabs, getVersionDetail } from "@/lib/data/submissions";
import { getCurrentUser, isSupabaseConfigured } from "@/lib/data/workspace";
import { formatDate } from "@/lib/format";
import { SUBMISSION_TAB_LABELS } from "@/lib/schemas/submission";
import { DecisionForm } from "./decision-form";

const TEXT = {
  back: "← 결재함",
  backMine: "← 내 시안",
  forbidden: "이 시안은 팀장과 작성자만 볼 수 있어요. 승인된 시안은 AI 분석에서 볼 수 있어요.",
  title: (product: string, tab: string, no: number) => `${product} · ${tab} v${no}`,
  submission: "시안",
  author: "작성자",
  submitted: "제출일",
  dataAsOf: "데이터 기준",
  note: "메모",
  standard: "지금 기준 승인본",
  summary: "한 줄 결론",
  before: (no: number) => `v${no}에서는`,
  content: "내용",
  diffNote: (no: number) => `괄호 안 숫자와 "→"는 v${no}와 달라진 부분이에요.`,
  decisions: "결재 기록",
  noDecisions: "아직 결재 기록이 없어요.",
  history: "버전 히스토리",
  self: "자기 결재",
  memberOnly: "승인 · 반려는 팀장만 할 수 있어요.",
  sample: "샘플 데이터예요. 로그인한 워크스페이스에서만 결재할 수 있어요.",
  notPending: "결재 대기 중인 버전만 결재할 수 있어요.",
  risk: (n: number) => `이 시안의 광고 문구 ${n}건에 위험 높음 또는 전문가 확인 요청이 있어요. 팀장 결재는 약기법 검토를 대신하지 않아요.`,
  adReview: "원본 광고 검토 상태",
  adReviewNote: "시안 결재와 약기법 검토는 별개입니다. 원본 검토 상태는 광고 검토 화면에서 결정합니다.",
};

export default async function VersionPreviewPage({ params }: { params: Promise<{ versionId: string }> }) {
  const detail = await getVersionDetail((await params).versionId);
  if (!detail) notFound();
  const { version, submission, history, previous, decisions, productName, memberName } = detail;
  const sampleMode = !isSupabaseConfigured();
  const [my, me] = await Promise.all([getMyTabs(), sampleMode ? null : getCurrentUser()]);
  const isOwner = my.role === "owner";
  const backLink = (
    <Link href={isOwner ? "/approvals" : "/approvals/mine"} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
      {isOwner ? TEXT.back : TEXT.backMine}
    </Link>
  );
  const isAuthor = me !== null && version.author_id === me.id;
  if (!sampleMode && !isOwner && !isAuthor && version.status !== "approved") {
    return (
      <>
        {backLink}
        <p className="mt-6 text-sm text-muted-foreground">{TEXT.forbidden}</p>
      </>
    );
  }

  // 보완 7: 근거 광고 문구의 지금 상태로 위험 경고를 정한다
  const adIds = new Set(version.evidence.filter((e) => e.kind === "ad_check").map((e) => e.id));
  const adChecks = adIds.size ? (await getAdChecks({ source: "all" })).filter((c) => adIds.has(c.id)) : [];
  const risky = adChecks.filter((c) => c.overall_risk === "high" || c.is_expert_review_requested === true);
  const standard = history.find((v) => v.id === submission.approved_version_id);
  const canDecide = !sampleMode && my.role === "owner" && version.status === "submitted";

  return (
    <>
      {backLink}
      <PageHeader title={TEXT.title(productName, SUBMISSION_TAB_LABELS[submission.tab], version.version_no)} featureId="M" />
      <DetailTemplate
        badges={<VersionStatusBadge status={version.status} />}
        attributes={[
          { label: TEXT.submission, value: submission.title },
          { label: TEXT.author, value: memberName(version.author_id) },
          { label: TEXT.submitted, value: version.submitted_at ? formatDate(version.submitted_at) : "—" },
          { label: TEXT.dataAsOf, value: version.data_as_of ? formatDate(version.data_as_of) : "—" },
          { label: TEXT.standard, value: standard ? `v${standard.version_no}` : "—" },
          { label: TEXT.note, value: version.note ?? "—" },
        ]}
        sections={[
          {
            title: TEXT.summary,
            content: (
              <div className="space-y-1 text-sm">
                <p>{version.summary || "—"}</p>
                {previous && previous.summary !== version.summary && (
                  <p className="text-muted-foreground">
                    {TEXT.before(previous.version_no)}: {previous.summary || "—"}
                  </p>
                )}
              </div>
            ),
          },
          {
            title: TEXT.content,
            content: (
              <div className="space-y-2">
                {previous && <p className="text-xs text-muted-foreground">{TEXT.diffNote(previous.version_no)}</p>}
                <SubmissionBody tab={submission.tab} body={version.body} previous={previous?.body ?? null} />
                {submission.tab === "ad" && (
                  <div className="space-y-2 border-t pt-3 text-sm">
                    <p className="font-medium">{TEXT.adReview}</p>
                    <p className="text-xs text-muted-foreground">{TEXT.adReviewNote}</p>
                    {adChecks.map((check) => (
                      <div key={check.id} className="flex flex-wrap items-center gap-2">
                        <Link href={`/ad-check/${check.id}`} className="underline-offset-4 hover:underline">
                          {check.input_text.split("\n")[0]}
                        </Link>
                        <ReviewStateBadge status={check.review_status} expertRequested={check.is_expert_review_requested} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ),
          },
          {
            title: TEXT.decisions,
            content:
              decisions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{TEXT.noDecisions}</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {decisions.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center gap-2">
                      <span>v{history.find((v) => v.id === d.version_id)?.version_no ?? "?"}</span>
                      <VersionStatusBadge status={d.decision} />
                      <span className="text-muted-foreground">
                        {memberName(d.reviewer_id)} · {formatDate(d.decided_at)}
                        {d.is_self_review && ` · ${TEXT.self}`}
                      </span>
                      {d.reason && <span className="basis-full whitespace-pre-line">{d.reason}</span>}
                    </li>
                  ))}
                </ul>
              ),
          },
          {
            title: TEXT.history,
            content: (
              <ol className="space-y-1 text-sm">
                {history.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center gap-2">
                    {v.id === version.id ? (
                      <span className="font-semibold">v{v.version_no}</span>
                    ) : (
                      <Link href={`/approvals/${v.id}`} className="underline-offset-4 hover:underline">
                        v{v.version_no}
                      </Link>
                    )}
                    <VersionStatusBadge status={v.status} />
                    <span className="text-muted-foreground">{v.summary}</span>
                  </li>
                ))}
              </ol>
            ),
          },
        ]}
      />
      {canDecide ? (
        <DecisionForm
          versionId={version.id}
          isSelf={version.author_id !== null && version.author_id === me?.id}
          riskWarning={risky.length ? TEXT.risk(risky.length) : null}
        />
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          {sampleMode ? TEXT.sample : my.role !== "owner" ? TEXT.memberOnly : version.status === "submitted" ? "" : TEXT.notPending}
        </p>
      )}
    </>
  );
}
