import { AiDisclaimer } from "@/components/common/ai";
import { PageHeader } from "@/components/layout/page-header";
import { getAppealComparison, getSearchSnapshots } from "@/lib/data";
import { APPEAL_TOPICS } from "@/lib/schemas/review";
import { ContentGuide, type GuideMaterials } from "../_components/content-guide";
import { GUIDE_DRAFTS } from "../_lib/content-guide-samples";
import { PRODUCTS } from "../_lib/products";

const MAX_KEYWORDS = 5;

export default async function ContentGuidePage() {
  // 반영할 재료 (가짜 데이터, 읽기만): 리뷰 분석의 소구점 · 시장 분석의 검색어 순위
  const [appeals, snapshots] = await Promise.all([Promise.all(PRODUCTS.map((p) => getAppealComparison(p.id))), getSearchSnapshots()]);
  const latest = snapshots.findLast((s) => s.engine === "google_autocomplete");
  const keywords = (latest?.suggestions ?? []).slice(0, MAX_KEYWORDS).map((s) => s.value);
  const materials: GuideMaterials = Object.fromEntries(
    PRODUCTS.map((p, i) => {
      const appeal = appeals[i];
      const praised = (appeal?.topics ?? [])
        .filter((t) => t.praises.length > 0)
        .toSorted((a, b) => b.praiseShare - a.praiseShare)
        .map((t) => APPEAL_TOPICS[t.topic].positive.ko);
      return [p.id, { hasReviews: (appeal?.ownReviewCount ?? 0) > 0, appeals: praised, keywords }];
    }),
  );

  return (
    <>
      <PageHeader
        title="콘텐츠 제작 가이드"
        description="리뷰 소구점과 검색어를 반영해 채널별로 약기법에 맞는 일본어 문구를 추천합니다"
        featureId="A"
      />
      <AiDisclaimer />
      <p className="mt-2 text-xs text-muted-foreground">샘플 데이터 · AI 미연결 · 게시 전에는 새 검토로 다시 확인하세요</p>
      <div className="mt-4">
        <ContentGuide products={PRODUCTS} drafts={GUIDE_DRAFTS} materials={materials} />
      </div>
    </>
  );
}
