import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { getAdCheck, getContentGuide, getWorkspace } from "@/lib/data";
import { getMyWorkspace, isSupabaseConfigured } from "@/lib/data/workspace";
import { ReviewWorkspace } from "./_components/review-workspace";
import { getAdProducts } from "@/lib/data/ad-products";
import { AdDisclaimer } from "./_components/ad-disclaimer";
import { flaggedKeys, guideToReviewInput } from "./_lib/guide-to-review";
import { buildWarnings } from "./_lib/guide-warnings";
import { makeFill } from "./_lib/guide-report";

type AdCheckPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdCheckPage({ searchParams }: AdCheckPageProps) {
  // 검토 이력의 「재검토」: ?from=<검토 ID> / 만든 가이드의 「이 문구로 새 검토」: ?guide=<가이드 ID>
  // 원문·제품·용도를 입력칸에 채운다 (자동으로 판정하지 않는다)
  const products = await getAdProducts();
  const { from, guide: guideId } = await searchParams;
  const [workspace, mine, source, guide] = await Promise.all([
    getWorkspace(),
    isSupabaseConfigured() ? getMyWorkspace() : null,
    typeof from === "string" ? getAdCheck(from) : null,
    typeof guideId === "string" ? getContentGuide(guideId) : null,
  ]);
  // 만든 가이드에서 왔으면 걸린 칸(제목 · 블록)만 넘긴다 (걸린 칸이 없으면 전부). 해시태그 주의는 따로 보여 준다
  const guideFlagged = guide && !source ? flaggedKeys(guide.guide.lint_hits, guide.checks) : undefined;
  const hashtagWarnings = guide && !source ? (buildWarnings(guide.guide.lint_hits, guide.checks).hashtags ?? []) : [];
  const initial = source
    ? { productId: source.product_id, usage: source.usage, text: source.input_text }
    : guide
      ? guideToReviewInput(guide.guide, guideFill(guide.guide.product_id), guideFlagged?.size ? guideFlagged : undefined)
      : undefined;
  /** 가이드의 자리표시자({product_ja} 등)를 그 제품 값으로 (제품을 못 찾으면 그대로) */
  function guideFill(productId: string | null) {
    const product = products.find((p) => p.id === productId);
    return product ? makeFill(product) : undefined;
  }
  const canApprove = !isSupabaseConfigured() || mine?.role === "owner";

  return (
    <>
      <PageHeader title="문구 검토" description="약기법 위험 표현, 사유·근거, 대체 표현, 현지화를 줄별로 확인합니다" featureId="A" />
      <AdDisclaimer extra="판정하면 검토 기록에 자동 저장돼요. 결재는 콘텐츠 가이드 단위로 올려요 (콘텐츠 제작 가이드 → 걸린 문구 고치기 → 결재)." />
      {guide && !source && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
          <span className="space-y-1">
            <span className="block">
              {guideFlagged?.size
                ? `콘텐츠 가이드에서 걸린 문구 ${guideFlagged.size}줄만 불러왔어요.`
                : "콘텐츠 가이드의 제목 · 본문을 한 줄씩 불러왔어요."}{" "}
              「검토 요청」으로 판정하고 대체 표현을 고르면 「가이드에 반영」으로 가이드를 고칠 수 있어요. 줄을 더하거나 지우면 반영할 수 없어요.
            </span>
            {hashtagWarnings.length > 0 && <span className="block text-risk-medium">해시태그 주의: {hashtagWarnings.join(" · ")} (해시태그는 문구 검토로 고칠 수 없어요. 게시할 때 빼거나 바꿔 주세요)</span>}
          </span>
          <Link href={`/ad-check/guide/history/${guide.guide.id}`} className={`${buttonVariants({ variant: "outline", size: "sm" })} border-foreground/40!`}>
            콘텐츠 가이드로 돌아가기
          </Link>
        </div>
      )}
      {source && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
          <span>검토 기록의 문구를 불러왔어요. 고친 뒤 「검토 요청」을 누르면 다시 판정합니다.</span>
          <Link href="/ad-check/history" className={`${buttonVariants({ variant: "outline", size: "sm" })} border-foreground/40!`}>
            수정하지 않고 검토 기록으로 돌아가기
          </Link>
        </div>
      )}
      <div className="mt-4">
        {products.length ? (
          <ReviewWorkspace key={source?.id ?? guide?.guide.id ?? "new"} products={products} workspaceId={workspace.id} canApprove={canApprove} initial={initial} guideId={guide && !source ? guide.guide.id : undefined} />
        ) : (
          <p>전성분이 등록된 자사 제품이 없습니다. 제품 정보를 먼저 등록해 주세요.</p>
        )}
      </div>
    </>
  );
}
