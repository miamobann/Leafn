// 내 시안 (docs/team-approval-ai-analysis.md 3장 1~4): 내가 탭별로 올린 시안 버전과 팀장 검토 상황.
// 결재함은 팀장만 보므로 팀원은 여기서 결재 대기 · 승인 · 반려(사유)를 확인하고, 원본 탭으로 가서 고쳐 다시 올린다
import Link from "next/link";
import { VersionStatusBadge } from "@/components/common/submission-badges";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { getMySubmissions } from "@/lib/data/submissions";
import { isSupabaseConfigured } from "@/lib/data/workspace";
import { formatDate } from "@/lib/format";
import { guideLabelOf, SUBMISSION_TAB_LABELS, type VersionStatus } from "@/lib/schemas/submission";

const TEXT = {
  title: "내 시안",
  description: "내가 탭별로 올린 시안과 팀장 검토 상황이에요. 시안은 시장 분석 요약 · 리뷰 분석 요약 · 광고 검토 상세 아래 「시안 · 결재」에서 올려요",
  sample: "샘플 데이터예요. 로그인하면 내가 올린 시안만 보여요.",
  empty: "아직 올린 시안이 없어요. 시장 분석 요약 · 리뷰 분석 요약 · 광고 검토 상세 화면 아래에서 「결재 올리기」를 눌러 보세요.",
  counts: (waiting: number, rejected: number) => `결재 대기 ${waiting}건 · 반려 ${rejected}건`,
  source: "원본 탭에서 보기",
  preview: "미리보기",
  reason: "반려 사유",
  /** 팀장 검토 상황 한 줄 */
  state: {
    draft: "아직 올리지 않은 임시 저장이에요",
    submitted: "팀장 결재를 기다리고 있어요",
    approved: "팀장이 승인했어요",
    rejected: "팀장이 반려했어요. 사유를 보고 새 버전을 올려 주세요",
    withdrawn: "제출을 취소했어요",
  } satisfies Record<VersionStatus, string>,
};

export default async function MySubmissionsPage() {
  const rows = await getMySubmissions();
  const waiting = rows.filter((r) => r.version.status === "submitted").length;
  const rejected = rows.filter((r) => r.version.status === "rejected").length;

  return (
    <>
      <PageHeader title={TEXT.title} description={TEXT.description} featureId="M" />
      {!isSupabaseConfigured() && <p className="mb-4 text-sm text-muted-foreground">{TEXT.sample}</p>}
      {rows.length === 0 ? (
        <p className="rounded-md border p-4 text-sm text-muted-foreground">{TEXT.empty}</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">{TEXT.counts(waiting, rejected)}</p>
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.version.id} className="rounded-lg border bg-card p-4 text-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">{SUBMISSION_TAB_LABELS[r.submission.tab]}</span>
                  <span className="font-medium">
                    {r.productName} · v{r.version.version_no}
                  </span>
                  {guideLabelOf(r.submission.tab, r.version.body) && <span className="font-medium">{guideLabelOf(r.submission.tab, r.version.body)}</span>}
                  <VersionStatusBadge status={r.version.status} />
                  <span className="text-muted-foreground">{formatDate(r.version.submitted_at ?? r.version.created_at)}</span>
                  <span className="ml-auto flex flex-wrap gap-2">
                    <Link href={r.sourceHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      {TEXT.source}
                    </Link>
                    <Link href={`/approvals/${r.version.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                      {TEXT.preview}
                    </Link>
                  </span>
                </div>
                {r.version.summary && <p className="mt-2">{r.version.summary}</p>}
                <p className="mt-1 text-muted-foreground">
                  {TEXT.state[r.version.status]}
                  {r.decision && ` · ${r.reviewerName} · ${formatDate(r.decision.decided_at)}`}
                </p>
                {r.version.status === "rejected" && r.decision?.reason && (
                  <div role="note" className="mt-2 rounded-md border border-status-rejected/40 bg-status-rejected/5 p-3">
                    <p className="font-medium">{TEXT.reason}</p>
                    <p className="mt-1 whitespace-pre-line">{r.decision.reason}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
