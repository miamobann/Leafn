import { notFound } from "next/navigation";
import { getReviewProductList, getReviewsOf } from "@/lib/data/reviews";
import { platformLabel } from "@/lib/platforms";
import { ReportView } from "./report-view";

export default async function ReviewReportPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const products = await getReviewProductList();
  const product = products.find((p) => p.id === productId);
  if (!product) notFound();

  const lang = product.kind === "own" ? "ko" : "ja";
  const reviews = (await getReviewsOf(productId)).filter((r) => r.lang === lang);

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
    .map((p) => ({ id: p.id, label: p.kind === "own" ? `${p.name} (자사)` : `${p.brand} ${p.name}${p.rank ? ` (${p.rank}위)` : ""}` }));

  return (
    <ReportView
      product={{ ...product, platformLabel: platformLabel(product.platform) }}
      reviews={reviews}
      ownCompare={ownCompare}
      options={options}
    />
  );
}
