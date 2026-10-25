import { redirect } from "next/navigation";
import { EmptyState } from "@/components/common/states";
import { getReviewProductList } from "@/lib/data/reviews";

// 위쪽 줄의 [상세페이지용 리뷰] 탭. 화면은 제품마다 있어서(/reviews/<제품>/translate), 국내 리뷰가 있는 판매중 자사 제품 중 리뷰가 가장 많은 것으로 보낸다.
// 다른 제품은 그 화면 제목 옆이나 리포트의 [상세페이지용 리뷰 만들기]로 옮겨 간다
export default async function ReviewTranslateEntryPage() {
  const products = await getReviewProductList();
  const own = products
    .filter((p) => p.kind === "own" && p.ko > 0 && p.saleStatus !== "in_development")
    .toSorted((a, b) => b.ko - a.ko)[0];
  if (own) redirect(`/reviews/${own.id}/translate`);
  return <EmptyState message="상세페이지에 올릴 국내 리뷰가 아직 없어요" action="리뷰 가져오기에서 우리 제품 리뷰를 먼저 올려 주세요" />;
}
