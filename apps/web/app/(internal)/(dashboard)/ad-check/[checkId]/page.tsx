import Link from "next/link";
import { notFound } from "next/navigation";
import { AiResultMeta } from "@/components/common/ai";
import { PageHeader } from "@/components/layout/page-header";
import { DetailTemplate } from "@/components/templates";
import { buttonVariants } from "@/components/ui/button";
import { getAdCheck, getAdChecks, getMemberName, getProduct } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { ActionBadge, ReviewStateBadge, USAGE_LABEL } from "../_components/ad-badges";
import { LineResultCard } from "../_components/line-result-card";
import { ResultSummary } from "../_components/result-summary";
import { AdDisclaimer } from "../_components/ad-disclaimer";

export async function generateStaticParams() {
  return (await getAdChecks()).map((a) => ({ checkId: a.id }));
}

export default async function AdCheckDetailPage({ params }: { params: Promise<{ checkId: string }> }) {
  const check = await getAdCheck((await params).checkId);
  if (!check) notFound();
  const [reviewer, product] = await Promise.all([getMemberName(check.reviewer_id), check.product_id ? getProduct(check.product_id) : null]);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <PageHeader title="검토 상세" featureId="A" />
        <div className="flex flex-wrap gap-2">
          <Link href="/ad-check/history" className={`${buttonVariants({ variant: "outline" })} border-foreground/40!`}>
            검토 내역 목록
          </Link>
          <Link href={`/ad-check?from=${check.id}`} className={buttonVariants()}>
            이 내용으로 새 검토
          </Link>
        </div>
      </div>
      <AdDisclaimer />
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
            { label: "제품", value: product?.name ?? "—" },
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
                  <ResultSummary check={check} />
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
