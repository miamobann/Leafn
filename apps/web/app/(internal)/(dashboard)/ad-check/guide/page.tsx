import { PageHeader } from "@/components/layout/page-header";
import { isSupabaseConfigured } from "@/lib/data/workspace";
import { AppealTopic } from "@/lib/schemas/review";
import { AdDisclaimer } from "../_components/ad-disclaimer";
import { ContentGuide } from "../_components/content-guide";
import { GUIDE_DRAFTS } from "../_lib/content-guide-samples";
import { loadGuideContext } from "../_lib/guide-context";

type ContentGuidePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** 리뷰 분석 「소구점 찾기」의 버튼: ?product=<제품 ID>&topics=<소구점 키들, 쉼표> (모르는 키는 버린다) */
function parseTopics(raw: string | string[] | undefined): AppealTopic[] {
  if (typeof raw !== "string") return [];
  return [...new Set(raw.split(","))].flatMap((t) => {
    const parsed = AppealTopic.safeParse(t.trim());
    return parsed.success ? [parsed.data] : [];
  });
}

export default async function ContentGuidePage({ searchParams }: ContentGuidePageProps) {
  const params = await searchParams;
  const productParam = typeof params.product === "string" ? params.product : undefined;
  const { products, materials, author, aiEnabled } = await loadGuideContext(productParam ? { productId: productParam, topics: parseTopics(params.topics) } : undefined);
  const known = productParam ? products.some((p) => p.id === productParam) : false;
  return (
    <>
      <PageHeader
        title="콘텐츠 제작 가이드"
        description="리뷰 소구점과 검색어를 반영해 채널별로 약기법에 맞는 일본어 문구를 추천합니다"
        featureId="A"
      />
      <AdDisclaimer />
      <p className="mt-2 text-xs text-muted-foreground">게시 전에는 새 검토로 다시 확인하세요</p>
      {productParam && !known && products.length > 0 && (
        <p className="mt-3 rounded-lg border p-3 text-sm">
          고른 제품은 전성분·가격·용량이 아직 등록되지 않아 가이드를 만들 수 없어요. 첫 번째 제품으로 열었어요 (고른 소구점은 반영하지 않았어요).
        </p>
      )}
      <div className="mt-4">
        {products.length ? (
          <ContentGuide
            products={products}
            drafts={isSupabaseConfigured() ? [] : GUIDE_DRAFTS}
            materials={materials}
            author={author}
            aiEnabled={aiEnabled}
            initialProductId={known ? productParam : undefined}
          />
        ) : (
          <p>전성분·가격·용량이 등록된 제품이 없습니다.</p>
        )}
      </div>
    </>
  );
}
