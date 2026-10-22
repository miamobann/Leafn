import { notFound } from "next/navigation";
import { AiDisclaimer, AiResultMeta } from "@/components/common/ai";
import { RiskBadge, StatusBadge } from "@/components/common/badges";
import { PageHeader } from "@/components/layout/page-header";
import { DetailTemplate } from "@/components/templates";
import { getAdCheck, getAdChecks, getMemberName } from "@/lib/data";
import { formatDate } from "@/lib/format";

export async function generateStaticParams() {
  return (await getAdChecks()).map((a) => ({ checkId: a.id }));
}

export default async function AdCheckDetailPage({ params }: { params: Promise<{ checkId: string }> }) {
  const check = await getAdCheck((await params).checkId);
  if (!check) notFound();
  const reviewer = await getMemberName(check.reviewer_id);

  return (
    <>
      <PageHeader title="검토 상세" featureId="A" />
      <AiDisclaimer />
      <div className="mt-4">
        <DetailTemplate
          badges={
            <>
              <StatusBadge status={check.review_status} />
              {check.overall_risk && <RiskBadge risk={check.overall_risk} />}
            </>
          }
          attributes={[
            { label: "원문", value: <span lang={check.input_lang}>{check.input_text}</span> },
            { label: "최종 문구", value: check.final_text ? <span lang="ja">{check.final_text}</span> : "—" },
            { label: "검토자", value: reviewer },
            { label: "검토일", value: check.reviewed_at ? formatDate(check.reviewed_at) : "—" },
            { label: "메모", value: check.reviewer_note ?? "—" },
          ]}
          sections={[
            {
              title: "판정",
              content: (
                <div className="space-y-2 text-sm">
                  {check.findings.length === 0 && <p>위험 표현이 없어요.</p>}
                  {check.findings.map((f) => (
                    <div key={f.text} className="flex items-center gap-2">
                      <RiskBadge risk={f.risk} /> <span lang="ja">{f.text}</span> — {f.reason}
                    </div>
                  ))}
                  <AiResultMeta model={check.model} promptVersion={check.prompt_version} createdAt={check.created_at} />
                </div>
              ),
            },
          ]}
        />
      </div>
    </>
  );
}
