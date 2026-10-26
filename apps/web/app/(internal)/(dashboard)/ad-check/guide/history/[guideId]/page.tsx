import Link from "next/link";
import { notFound } from "next/navigation";
import { AiResultMeta } from "@/components/common/ai";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { getContentGuide, getContentGuides } from "@/lib/data";
import { getMyWorkspace } from "@/lib/data/workspace";
import { AdDisclaimer } from "../../../_components/ad-disclaimer";
import { ContentGuide } from "../../../_components/content-guide";
import { DeleteButton } from "../../../_components/delete-button";
import { GuideDraft } from "../../../_lib/content-guide-samples";
import { loadGuideContext } from "../../../_lib/guide-context";
import { buildWarnings } from "../../../_lib/guide-warnings";

/** 저장된 결과물을 만들었을 때 화면 그대로 다시 연다 (미리보기 · 본문 · 촬영 가이드 · PDF). AI는 다시 부르지 않는다 */
export default async function GuideHistoryDetailPage({ params }: { params: Promise<{ guideId: string }> }) {
  const found = await getContentGuide((await params).guideId);
  if (!found) notFound();
  const { guide, checks } = found;
  const [{ products, materials, author, aiEnabled }, mine, all] = await Promise.all([loadGuideContext(), getMyWorkspace().catch(() => null), getContentGuides()]);
  // 수정본: 새 검토에서 고친 문구를 「가이드에 반영」한 것 (원본은 그대로 남는다). 목록은 최신순
  const revisions = all.filter((g) => g.parent_id === guide.id);
  const product = products.find((p) => p.id === guide.product_id);
  const draft = GuideDraft.parse({
    id: guide.id,
    channel: guide.channel,
    post_type: guide.post_type,
    title_ja: guide.title.title_ja,
    title_ko: guide.title.title_ko,
    recommended: guide.title.recommended,
    reason: guide.title.reason,
    blocks: guide.body.blocks,
    hashtags: guide.body.hashtags,
    gallery: guide.body.gallery,
  });

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <PageHeader title="만든 가이드" description="저장된 결과물을 만들었을 때 그대로 보여 줍니다" featureId="A" />
        {mine?.role === "owner" && (
          <DeleteButton endpoint={`/api/content-guide/${guide.id}`} confirmMessage="이 가이드를 삭제할까요? 지운 결과물은 되돌릴 수 없습니다. (약기법 검사 기록은 남아요)" redirectTo="/ad-check/guide/history" />
        )}
      </div>
      <AdDisclaimer />
      {guide.parent_id && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
          <span>새 검토에서 대체 표현으로 고친 문구를 반영한 수정본이에요. 약기법에 걸렸던 원본과 그 검사 기록은 그대로 남아 있어요.</span>
          <Link href={`/ad-check/guide/history/${guide.parent_id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            원본 보기
          </Link>
        </div>
      )}
      {revisions[0] && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
          <span>이 가이드를 고친 수정본이 {revisions.length}개 있어요. 게시에는 수정본을 쓰세요.</span>
          <Link href={`/ad-check/guide/history/${revisions[0].id}`} className={buttonVariants({ size: "sm" })}>
            최신 수정본 보기
          </Link>
        </div>
      )}
      <div className="mt-4 space-y-4">
        {product ? (
          <ContentGuide
            key={guide.id}
            products={products}
            drafts={[]}
            materials={materials}
            author={author}
            aiEnabled={aiEnabled}
            saved={{
              productId: product.id,
              channel: guide.channel,
              postType: guide.post_type,
              slideCount: guide.input.slide_count,
              direction: guide.input.direction,
              draft,
              warnings: buildWarnings(guide.lint_hits, checks),
              memos: guide.memos ?? undefined,
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">이 결과물의 제품을 찾을 수 없어요 (삭제됐거나 전성분·가격·용량이 비어 있어요).</p>
        )}
        <AiResultMeta model={guide.model} promptVersion={guide.prompt_version} createdAt={guide.created_at} />
      </div>
    </>
  );
}
