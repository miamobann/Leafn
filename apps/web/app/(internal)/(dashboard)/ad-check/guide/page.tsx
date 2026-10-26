import { PageHeader } from "@/components/layout/page-header";
import { isSupabaseConfigured } from "@/lib/data/workspace";
import { AdDisclaimer } from "../_components/ad-disclaimer";
import { ContentGuide } from "../_components/content-guide";
import { GUIDE_DRAFTS } from "../_lib/content-guide-samples";
import { loadGuideContext } from "../_lib/guide-context";

export default async function ContentGuidePage() {
  const { products, materials, author, aiEnabled } = await loadGuideContext();
  return (
    <>
      <PageHeader
        title="콘텐츠 제작 가이드"
        description="리뷰 소구점과 검색어를 반영해 채널별로 약기법에 맞는 일본어 문구를 추천합니다"
        featureId="A"
      />
      <AdDisclaimer />
      <p className="mt-2 text-xs text-muted-foreground">게시 전에는 새 검토로 다시 확인하세요</p>
      <div className="mt-4">
        {products.length ? <ContentGuide products={products} drafts={isSupabaseConfigured() ? [] : GUIDE_DRAFTS} materials={materials} author={author} aiEnabled={aiEnabled} /> : <p>전성분·가격·용량이 등록된 제품이 없습니다.</p>}
      </div>
    </>
  );
}
