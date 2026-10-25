// 팀장 결재함 (docs/team-approval-ai-analysis.md 3장 3, 7장 3단계). 결재 대기 버전을 오래 기다린 것부터 보이고,
// 행을 누르면 버전 미리보기에서 내용을 보고 승인 · 반려한다. 목록은 멤버 모두 볼 수 있다 (4장 권한 표)
import { PageHeader } from "@/components/layout/page-header";
import { DataTableTemplate } from "@/components/templates";
import { VersionStatusBadge } from "@/components/common/submission-badges";
import { getApprovalInbox, getMyTabs, STALE_REVIEW_DAYS } from "@/lib/data/submissions";
import { formatDate } from "@/lib/format";
import { SUBMISSION_TAB_LABELS } from "@/lib/schemas/submission";

const TEXT = {
  title: "결재함",
  description: "팀원이 제출한 시안 버전을 미리 보고 승인 · 반려해요",
  memberNote: "승인 · 반려는 팀장만 할 수 있어요. 목록과 미리보기는 모두 볼 수 있어요.",
  pending: (n: number) => `결재 대기 ${n}건`,
  stale: `${STALE_REVIEW_DAYS}일 넘게 기다린 결재는 굵게 표시해요.`,
  recent: "최근 결재",
  waiting: (days: number) => (days === 0 ? "오늘" : `${days}일째`),
};

export default async function ApprovalsPage() {
  const [{ pending, recent }, my] = await Promise.all([getApprovalInbox(), getMyTabs()]);

  return (
    <>
      <PageHeader title={TEXT.title} description={TEXT.description} featureId="M" />
      {my.role !== "owner" && <p className="mb-4 text-sm text-muted-foreground">{TEXT.memberNote}</p>}

      <h2 className="mb-1 font-semibold">{TEXT.pending(pending.length)}</h2>
      <p className="mb-3 text-sm text-muted-foreground">{TEXT.stale}</p>
      <DataTableTemplate
        columns={[
          { key: "product", label: "제품" },
          { key: "tab", label: "탭" },
          { key: "version", label: "버전" },
          { key: "summary", label: "한 줄 결론" },
          { key: "author", label: "작성자" },
          { key: "submitted", label: "제출일" },
          { key: "waiting", label: "대기", align: "right" },
        ]}
        rows={pending.map((r) => ({
          id: r.version.id,
          href: `/approvals/${r.version.id}`,
          cells: {
            product: r.productName,
            tab: SUBMISSION_TAB_LABELS[r.submission.tab],
            version: `v${r.version.version_no}`,
            summary: r.version.summary,
            author: r.authorName,
            submitted: formatDate(r.version.submitted_at ?? r.version.created_at),
            waiting: (
              <span className={r.waitingDays > STALE_REVIEW_DAYS ? "font-semibold text-status-pending" : undefined}>
                {TEXT.waiting(r.waitingDays)}
              </span>
            ),
          },
        }))}
      />

      <h2 className="mt-8 mb-3 font-semibold">{TEXT.recent}</h2>
      <DataTableTemplate
        columns={[
          { key: "product", label: "제품" },
          { key: "tab", label: "탭" },
          { key: "version", label: "버전" },
          { key: "decision", label: "결정" },
          { key: "reviewer", label: "결재자" },
          { key: "date", label: "날짜" },
          { key: "reason", label: "반려 사유" },
        ]}
        rows={recent.map((r) => ({
          id: r.review.id,
          href: `/approvals/${r.version.id}`,
          cells: {
            product: r.productName,
            tab: SUBMISSION_TAB_LABELS[r.submission.tab],
            version: `v${r.version.version_no}`,
            decision: <VersionStatusBadge status={r.review.decision} />,
            reviewer: `${r.reviewerName}${r.review.is_self_review ? " (자기 결재)" : ""}`,
            date: formatDate(r.review.decided_at),
            reason: r.review.reason ?? "—",
          },
        }))}
      />
    </>
  );
}
