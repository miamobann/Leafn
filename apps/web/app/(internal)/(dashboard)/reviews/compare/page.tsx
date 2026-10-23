import { ViewStateGate } from "@/components/common/view-state";
import { PageHeader } from "@/components/layout/page-header";
import { getAppealComparison, getProducts } from "@/lib/data";
import { AppealCompare, type AppealComparison } from "./appeal-compare";

export default async function ReviewsComparePage() {
  const own = await getProducts({ kind: "own" });
  const comparisons = (await Promise.all(own.map((p) => getAppealComparison(p.id)))).filter(
    (c): c is AppealComparison => c !== null,
  );

  return (
    <>
      <PageHeader
        title="소구점 찾기"
        description="일본 경쟁 제품의 낮은 평점 불만 중 우리 제품의 강점과 맞닿는 주제를 찾아요"
        featureId="E"
      />
      <ViewStateGate state={comparisons.length === 0 ? "empty" : "ready"} emptyAction="리뷰 CSV 올리기">
        <AppealCompare comparisons={comparisons} />
      </ViewStateGate>
    </>
  );
}
