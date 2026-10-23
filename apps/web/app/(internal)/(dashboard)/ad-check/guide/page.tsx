import { AiDisclaimer } from "@/components/common/ai";
import { PageHeader } from "@/components/layout/page-header";
import { ContentGuide } from "../_components/content-guide";
import { GUIDE_DRAFTS } from "../_lib/content-guide-samples";
import { PRODUCTS } from "../_lib/products";

export default function ContentGuidePage() {
  return (
    <>
      <PageHeader
        title="콘텐츠 제작 가이드"
        description="제품과 사용처를 고르면 약기법에 맞는 일본어 문구와 AI용 프롬프트 가이드를 보여줍니다"
        featureId="A"
      />
      <AiDisclaimer />
      <p className="mt-2 text-xs text-muted-foreground">샘플 데이터 · AI 미연결 · 게시 전에는 새 검토로 다시 확인하세요</p>
      <div className="mt-4">
        <ContentGuide products={PRODUCTS} drafts={GUIDE_DRAFTS} />
      </div>
    </>
  );
}
