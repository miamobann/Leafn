import Link from "next/link";
import { notFound } from "next/navigation";
import { EvidenceList } from "@/components/common/evidence-list";
import { PageHeader } from "@/components/layout/page-header";
import { BarList, ReportTemplate } from "@/components/templates";
import { getProduct, getProducts, getReviewReport } from "@/lib/data";

export async function generateStaticParams() {
  return (await getProducts()).map((p) => ({ productId: p.id }));
}

export default async function ReviewReportPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const product = await getProduct(productId);
  if (!product) notFound();
  const { reviews, insights, sentiment } = await getReviewReport(productId);
  const keywordCounts = new Map<string, number>();
  for (const r of reviews) for (const k of r.analysis?.keywords ?? []) keywordCounts.set(k.text, (keywordCounts.get(k.text) ?? 0) + 1);
  const evidence = (ids: string[]) => reviews.filter((r) => ids.includes(r.id));

  return (
    <>
      <PageHeader title={`리뷰 리포트 · ${product.brand} ${product.name}`} featureId="E" />
      <div className="mb-4 flex gap-4 text-sm">
        <Link href={`/reviews/${productId}/list`} className="underline-offset-4 hover:underline">
          원문 목록
        </Link>
        <Link href={`/reviews/${productId}/translate`} className="underline-offset-4 hover:underline">
          상세페이지용 리뷰 만들기
        </Link>
      </div>
      <ReportTemplate
        state={reviews.length === 0 ? "empty" : "ready"}
        emptyAction="리뷰 CSV 올리기"
        cards={[
          {
            title: "감성",
            content: (
              <BarList
                items={[
                  { label: "+ 긍정", value: sentiment.positive },
                  { label: "○ 중립", value: sentiment.neutral },
                  { label: "− 부정", value: sentiment.negative },
                ]}
              />
            ),
          },
          { title: "키워드", content: <BarList items={[...keywordCounts].map(([label, value]) => ({ label, value }))} /> },
          {
            title: "불만 유형",
            content: <BarList items={insights.filter((i) => i.kind === "pain_point").map((i) => ({ label: i.label_ko ?? i.label, value: i.count }))} />,
          },
          {
            title: "재구매 요인",
            content: <BarList items={insights.filter((i) => i.kind === "repurchase_factor").map((i) => ({ label: i.label, value: i.count }))} />,
          },
          {
            title: "근거 원문 (인사이트 전체)",
            wide: true,
            content: <EvidenceList reviews={evidence(insights.flatMap((i) => i.evidence_review_ids))} />,
          },
        ]}
      />
    </>
  );
}
