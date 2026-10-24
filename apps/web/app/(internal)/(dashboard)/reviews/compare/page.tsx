import { ViewStateGate } from "@/components/common/view-state";
import { PageHeader } from "@/components/layout/page-header";
import { getAppealComparisons } from "@/lib/data/reviews";
import { AppealTopic } from "@/lib/schemas/review";
import { ImportButton } from "../_components/parts";
import { AppealCompare } from "./appeal-compare";

export default async function ReviewsComparePage({ searchParams }: { searchParams: Promise<{ own?: string; topics?: string }> }) {
  const query = await searchParams;
  // DB가 연결돼 있으면 DB의 자사 리뷰 · 저장한 경쟁 제품 리뷰로, 아니면 샘플로 계산한다 (lib/data/reviews.ts)
  const comparisons = await getAppealComparisons();
  // 리포트에서 넘어오면 그 제품과 후보를 고른 채로 연다 (?own=<제품>&topics=texture,lasting_moisture)
  const topics = (query.topics ?? "").split(",").flatMap((t) => {
    const parsed = AppealTopic.safeParse(t);
    return parsed.success ? [parsed.data] : [];
  });

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="소구점 찾기" description="일본 경쟁 제품 리뷰의 불만 중, 자사 제품이 국내에서 칭찬받는 주제를 찾아요" featureId="E" />
        <ImportButton />
      </div>
      <ViewStateGate state={comparisons.length === 0 ? "empty" : "ready"} emptyAction="국내 리뷰가 있는 자사 제품이 없어요. 리뷰 가져오기에서 자사 리뷰를 먼저 저장해 주세요.">
        <AppealCompare comparisons={comparisons} initialOwnId={query.own} initialTopics={topics} />
      </ViewStateGate>
    </>
  );
}
