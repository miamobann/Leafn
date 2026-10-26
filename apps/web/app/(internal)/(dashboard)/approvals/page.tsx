// 팀장 결재함 (docs/team-approval-ai-analysis.md 3장 3, 7장 3단계). 결재함은 팀장(owner)만 본다 (2026-10-26 총괄 결정).
// 탭별로 거르고, 한 건을 펼쳐 바로 승인 · 반려하거나 원본 탭 · 버전 미리보기로 간다. 팀원은 「내 시안」으로 보낸다
import { redirect } from "next/navigation";
import { SubmissionBody } from "@/components/common/submission-body";
import { VersionStatusBadge } from "@/components/common/submission-badges";
import { PageHeader } from "@/components/layout/page-header";
import { DataTableTemplate } from "@/components/templates";
import { getAdChecks } from "@/lib/data";
import { getApprovalInbox, getMyTabs, STALE_REVIEW_DAYS } from "@/lib/data/submissions";
import { getCurrentUser, isSupabaseConfigured } from "@/lib/data/workspace";
import { formatDate } from "@/lib/format";
import { guideLabelOf, SUBMISSION_TAB_LABELS } from "@/lib/schemas/submission";
import { type InboxItem, InboxList } from "./inbox-list";

const TEXT = {
  title: "결재함",
  description: "팀원이 탭별로 올린 시안을 모아 봐요. 펼쳐서 바로 승인 · 반려하거나, 원본 탭으로 가서 확인할 수 있어요",
  sample: "샘플 데이터예요. 로그인한 워크스페이스에서만 결재할 수 있어요.",
  pending: (n: number) => `결재 대기 ${n}건`,
  stale: `${STALE_REVIEW_DAYS}일 넘게 기다린 시안은 굵게 표시해요.`,
  recent: "최근 결재",
  risk: (n: number) => `이 시안의 광고 문구 ${n}건에 위험 높음 또는 전문가 확인 요청이 있어요. 팀장 결재는 약기법 검토를 대신하지 않아요.`,
};

export default async function ApprovalsPage() {
  const my = await getMyTabs();
  if (my.role !== "owner") redirect("/approvals/mine");

  const sampleMode = !isSupabaseConfigured();
  const [{ pending, recent }, me] = await Promise.all([getApprovalInbox(), sampleMode ? null : getCurrentUser()]);
  // 광고 시안은 담긴 검토 건의 지금 상태로 위험 경고를 정한다 (설계 8장 보완 7)
  const adIds = new Set(pending.flatMap((r) => r.version.evidence.filter((e) => e.kind === "ad_check").map((e) => e.id)));
  const risky = adIds.size
    ? new Set((await getAdChecks({ source: "all" })).filter((c) => c.overall_risk === "high" || c.is_expert_review_requested === true).map((c) => c.id))
    : new Set<string>();

  const items: InboxItem[] = pending.map((r) => {
    const riskyCount = r.version.evidence.filter((e) => e.kind === "ad_check" && risky.has(e.id)).length;
    return {
      id: r.version.id,
      tab: r.submission.tab,
      productName: r.productName,
      versionNo: r.version.version_no,
      guideLabel: guideLabelOf(r.submission.tab, r.version.body),
      summary: r.version.summary,
      note: r.version.note,
      authorName: r.authorName,
      submittedLabel: formatDate(r.version.submitted_at ?? r.version.created_at),
      waitingDays: r.waitingDays,
      stale: r.waitingDays > STALE_REVIEW_DAYS,
      sourceHref: r.sourceHref,
      isSelf: r.version.author_id !== null && r.version.author_id === me?.id,
      riskWarning: riskyCount ? TEXT.risk(riskyCount) : null,
      preview: <SubmissionBody tab={r.submission.tab} body={r.version.body} previous={r.previousBody} />,
    };
  });

  return (
    <>
      <PageHeader title={TEXT.title} description={TEXT.description} featureId="M" />
      {sampleMode && <p className="mb-4 text-sm text-muted-foreground">{TEXT.sample}</p>}

      <h2 className="mb-1 font-semibold">{TEXT.pending(pending.length)}</h2>
      <p className="mb-3 text-sm text-muted-foreground">{TEXT.stale}</p>
      <InboxList items={items} canDecide={!sampleMode} />

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
