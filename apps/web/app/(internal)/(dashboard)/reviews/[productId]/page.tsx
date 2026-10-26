import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { getProduct } from "@/lib/data";
import { getAnalysisStatus } from "@/lib/data/review-analysis-actions";
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
  // 자사 제품 리포트는 판매 중이면 요약 탭(시안 · 결재)으로 가는 입구를 보인다
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
      {/* 결재는 요약 탭에서 한다: 소구점 · 일본어 후기를 담은 뒤 한 줄 결론을 쓰고 올린다 */}
      {owned?.sale_status === "on_sale" && (
        <div className="mb-4 flex justify-end">
          <Link href="/reviews/summary" className={buttonVariants({ variant: "outline", size: "sm" })}>
            요약에서 결재 올리기 →
          </Link>
        </div>
      )}
      <ReportView
        product={{ ...product, platformLabel: platformLabel(product.platform) }}
        reviews={reviews}
        ownCompare={ownCompare}
        options={options}
      />
    </>
  );
}
