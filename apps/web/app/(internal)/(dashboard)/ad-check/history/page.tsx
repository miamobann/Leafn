import { RiskBadge, StatusBadge } from "@/components/common/badges";
import { PageHeader } from "@/components/layout/page-header";
import { DataTableTemplate } from "@/components/templates";
import { getAdChecks, getMembers } from "@/lib/data";
import { formatDate } from "@/lib/format";

export default async function AdCheckHistoryPage() {
  const [checks, members] = await Promise.all([getAdChecks(), getMembers()]);
  const name = (id: string | null) => members.find((m) => m.user_id === id)?.display_name ?? "—";

  return (
    <>
      <PageHeader title="검토 이력" description="승인·반려 기록" featureId="A" />
      <DataTableTemplate
        emptyAction="새 검토 시작하기"
        columns={[
          { key: "text", label: "문구" },
          { key: "risk", label: "위험도" },
          { key: "status", label: "상태" },
          { key: "reviewer", label: "검토자" },
          { key: "date", label: "요청일" },
        ]}
        rows={checks.map((a) => ({
          id: a.id,
          href: `/ad-check/${a.id}`,
          cells: {
            text: <span lang={a.input_lang}>{a.input_text}</span>,
            risk: a.overall_risk ? <RiskBadge risk={a.overall_risk} /> : "—",
            status: <StatusBadge status={a.review_status} />,
            reviewer: name(a.reviewer_id),
            date: formatDate(a.created_at),
          },
        }))}
      />
    </>
  );
}
