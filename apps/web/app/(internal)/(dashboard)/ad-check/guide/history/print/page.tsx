import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { getContentGuides } from "@/lib/data";
import { ContentGuideReport } from "../../../_components/content-guide-report";
import { PrintButton } from "../../../_components/print-button";
import { GUIDE_CHANNELS, POST_TYPES } from "../../../_lib/content-guide-samples";
import { loadGuideContext } from "../../../_lib/guide-context";
import { makeFill, MAX_BUNDLE, pickHashtags, visibleBlocks } from "../../../_lib/guide-report";
import { buildCutList } from "../../../_lib/photo-guide";

type BundlePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** 만든 가이드 여러 개를 PDF 한 묶음으로 (디자이너 전달용). 고른 순서가 아니라 목록 순서(최신순)로 이어 붙인다. AI는 다시 부르지 않는다 */
export default async function GuideBundlePage({ searchParams }: BundlePageProps) {
  const raw = (await searchParams).ids;
  const picked = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(Boolean);
  const [guides, { products, materials, author }] = await Promise.all([getContentGuides(), loadGuideContext()]);
  const chosen = guides.filter((g) => picked.includes(g.id)).slice(0, MAX_BUNDLE);
  const reports = chosen.flatMap((g) => {
    const product = products.find((p) => p.id === g.product_id);
    if (!product) return [];
    const material = materials[product.id];
    const hasPostType = g.channel === "instagram" || g.channel === "x";
    const blocks = visibleBlocks(g.body.blocks, g.channel, g.input.slide_count, material?.hasReviews ?? false);
    const hashtags = hasPostType ? pickHashtags(g.body.hashtags, g.channel, material?.keywords ?? []).list : [];
    return [{ guide: g, product, material, blocks, hashtags, fill: makeFill(product), hasPostType }];
  });
  const skipped = picked.length - reports.length;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2 print:hidden">
        <PageHeader title="가이드 묶음 PDF" description={`고른 가이드 ${reports.length}개를 PDF 한 묶음으로 만듭니다 (최대 ${MAX_BUNDLE}개)`} featureId="A" />
        <span className="flex flex-wrap gap-2">
          <Link href="/ad-check/guide/history" className={buttonVariants({ variant: "outline" })}>
            만든 가이드로
          </Link>
          {reports.length > 0 && <PrintButton label={`PDF 출력 (${reports.length}개)`} />}
        </span>
      </div>
      {skipped > 0 && (
        <p className="mb-4 rounded-md border border-risk-medium/50 p-3 text-sm text-risk-medium print:hidden">
          {picked.length > MAX_BUNDLE ? `한 번에 ${MAX_BUNDLE}개까지만 묶어요. ` : ""}
          {skipped}개는 빠졌어요 (개수 초과이거나, 지워졌거나, 제품 정보를 찾을 수 없어요).
        </p>
      )}
      {reports.length === 0 ? (
        <p className="text-sm text-muted-foreground">묶을 가이드가 없어요. 「만든 가이드」에서 체크한 뒤 「선택한 가이드 PDF로 묶기」를 눌러 주세요.</p>
      ) : (
        <div className="space-y-6">
          <p className="text-xs text-muted-foreground print:hidden">아래는 인쇄 미리보기예요. 화면 메모는 저장되지 않아서 묶음 PDF에는 들어가지 않아요.</p>
          {reports.map((r, i) => (
            <ContentGuideReport
              key={r.guide.id}
              bundle={{ index: i }}
              channel={r.guide.channel}
              productName={r.product.name_ko}
              channelLabel={GUIDE_CHANNELS.find((c) => c.id === r.guide.channel)?.label ?? r.guide.channel}
              postTypeLabel={r.hasPostType ? (POST_TYPES.find((t) => t.id === r.guide.post_type)?.label ?? null) : null}
              author={author}
              title={{ ja: r.fill(r.guide.title.title_ja), ko: r.fill(r.guide.title.title_ko), reason: r.guide.title.reason }}
              appeals={r.material?.hasReviews ? r.material.appeals : []}
              keywords={r.material?.keywords ?? []}
              blocks={r.blocks}
              gallery={r.guide.channel === "qoo10_detail" ? r.guide.body.gallery : []}
              hashtags={r.hashtags}
              memos={{}}
              fill={r.fill}
              cutList={buildCutList(r.guide.channel, r.blocks, r.guide.body.gallery)}
              direction={r.guide.input.direction}
              footerNote={`AI 제작 · ${r.guide.model} · ${r.guide.prompt_version}`}
            />
          ))}
        </div>
      )}
    </>
  );
}
