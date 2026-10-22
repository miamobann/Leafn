import { notFound } from "next/navigation";
import { AiDisclaimer, AiResultMeta } from "@/components/common/ai";
import { PageHeader } from "@/components/layout/page-header";
import { DetailTemplate } from "@/components/templates";
import { getMemberName } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { ActionBadge, ReviewStateBadge, USAGE_LABEL } from "../_components/ad-badges";
import { LineResultCard } from "../_components/line-result-card";
import { getLabAdCheck, getLabAdChecks, getLabProducts } from "../_lib/data";

export async function generateStaticParams() {
  return (await getLabAdChecks()).map((a) => ({ checkId: a.id }));
}

export default async function AdCheckDetailPage({ params }: { params: Promise<{ checkId: string }> }) {
  const check = await getLabAdCheck((await params).checkId);
  if (!check) notFound();
  const [reviewer, products] = await Promise.all([getMemberName(check.reviewer_id), getLabProducts()]);
  const product = products.find((p) => p.id === check.product_id);

  return (
    <>
      <PageHeader title="검토 상세" featureId="A" />
      <AiDisclaimer />
      <div className="mt-4">
        <DetailTemplate
          badges={
            <>
              <ReviewStateBadge status={check.review_status} expertRequested={check.is_expert_review_requested} />
              {check.overall_action && <ActionBadge action={check.overall_action} />}
            </>
          }
          attributes={[
            { label: "원문", value: <span className="whitespace-pre-line" lang={check.input_lang}>{check.input_text}</span> },
            { label: "최종 문구", value: check.final_text ? <span className="whitespace-pre-line">{check.final_text}</span> : "—" },
            { label: "제품", value: product?.name_ko ?? "—" },
            { label: "사용처", value: check.usage ? USAGE_LABEL[check.usage] : "—" },
            { label: "검토자", value: reviewer },
            { label: "검토일", value: check.reviewed_at ? formatDate(check.reviewed_at) : "—" },
            { label: "메모", value: check.reviewer_note ?? "—" },
          ]}
          sections={[
            {
              title: "줄별 판정",
              content: (
                <div className="space-y-4">
                  {(check.line_results ?? []).map((line) => (
                    <LineResultCard
                      key={line.line_index}
                      line={line}
                      findings={check.findings.filter((f) => f.line_index === line.line_index)}
                    />
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
