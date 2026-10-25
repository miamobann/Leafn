import { notFound } from "next/navigation";
import { SubmissionSection } from "@/components/common/submission-section";
import { getProduct } from "@/lib/data";
import { getAnalysisStatus } from "@/lib/data/review-analysis-actions";
import { saveReviewDraft } from "@/lib/data/submission-actions";
import { getReviewProductList, getReviewsOf } from "@/lib/data/reviews";
import { platformLabel } from "@/lib/platforms";
import { titleParts } from "@/lib/product-title";
import { AnalyzeButton } from "../_components/analyze-button";
import { ReportView } from "./report-view";

export default async function ReviewReportPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const products = await getReviewProductList();
  const product = products.find((p) => p.id === productId);
  if (!product) notFound();

  const lang = product.kind === "own" ? "ko" : "ja";
  const reviews = (await getReviewsOf(productId)).filter((r) => r.lang === lang);
  const status = await getAnalysisStatus(productId);
  // 자사 제품 리포트는 아래에 시안 · 결재 패널을 붙인다 (docs/team-approval-ai-analysis.md 7장 2단계)
  const owned = product.kind === "own" ? await getProduct(productId) : null;

  // 경쟁 리포트는 같은 카테고리의 우리 제품(국내 리뷰가 가장 많은 것)과 주제를 맞대 본다
  let ownCompare = null;
  if (product.kind === "competitor") {
    const mine = products
      .filter((p) => p.kind === "own" && p.category === product.category && p.ko > 0)
      .toSorted((a, b) => b.ko - a.ko)[0];
    if (mine) ownCompare = { id: mine.id, name: mine.name, reviews: (await getReviewsOf(mine.id, { lang: "ko" })).filter((r) => r.analysis) };
  }

  // 다른 제품 보기: 리뷰가 있는 제품만
  const options = products
    .filter((p) => p.ko + p.ja > 0)
    .map((p) => ({ id: p.id, label: p.kind === "own" ? `${p.name} (자사)` : `${titleParts({ brand: p.brand, name: p.name, title_ai: p.titleAi }).main}${p.rank ? ` (${p.rank}위)` : ""}` }));

  return (
    <>
      <AnalyzeButton productId={productId} pending={status.pending} untranslated={status.untranslated} untitled={status.untitled} />
      <ReportView
        product={{ ...product, platformLabel: platformLabel(product.platform) }}
        reviews={reviews}
        ownCompare={ownCompare}
        options={options}
      />
      {owned && (
        <SubmissionSection
          tab="review"
          product={owned}
          saveDraft={saveReviewDraft.bind(null, productId)}
          snapshotNote="지금 리포트의 주제별 성적표 · 불만 · 재구매 요인과 근거 리뷰를 그대로 저장해요. 제출하면 고칠 수 없어요."
        />
      )}
    </>
  );
}
