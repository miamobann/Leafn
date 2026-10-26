import Link from "next/link";
import { notFound } from "next/navigation";
import { AiResultMeta } from "@/components/common/ai";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { getContentGuide, getContentGuides } from "@/lib/data";
import { getMyWorkspace } from "@/lib/data/workspace";
import { formatDate } from "@/lib/format";
import { ActionBadge } from "../../../_components/ad-badges";
import { koLines } from "../../../_lib/ko-lines";
import { loadContentRecord } from "../../../_lib/records";
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
  const [{ products, materials, author, aiEnabled }, mine, all, record] = await Promise.all([loadGuideContext(), getMyWorkspace().catch(() => null), getContentGuides(), loadContentRecord(guide.id)]);
  const versionNo = (record?.versions.findIndex((v) => v.id === guide.id) ?? -1) + 1;
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
        <PageHeader
          title={`콘텐츠 가이드${record && record.versions.length > 1 ? ` · v${versionNo}` : ""}`}
          description="만든 콘텐츠 가이드를 그대로 보여 줘요. 걸린 문구는 문구 검토로 고쳐 반영하고, 다 고치면 결재에 올려요"
          featureId="A"
        />
        {/* 최신 버전의 삭제 = 모든 버전 + 묶인 문구 검토 숨김 (검토 기록 목록과 같다). 이전 버전 화면에서는 그 버전만 지운다 */}
        {mine?.role === "owner" &&
          (revisions.length === 0 ? (
            <DeleteButton
              endpoint={`/api/content-guide/${guide.id}?all=1`}
              confirmMessage={`이 콘텐츠 가이드${record && record.versions.length > 1 ? `(v1~v${record.versions.length})` : ""}${record?.phrases.length ? `와 문구 검토 ${record.phrases.length}건` : ""}을 지울까요? 지운 콘텐츠 가이드는 되돌릴 수 없어요. (약기법 검사 기록은 남아요)`}
              redirectTo="/ad-check/history?type=content"
            />
          ) : (
            <DeleteButton endpoint={`/api/content-guide/${guide.id}`} confirmMessage="이 이전 버전만 지울까요? 최신 버전은 남아요. (약기법 검사 기록은 남아요)" redirectTo="/ad-check/history?type=content" />
          ))}
      </div>
      <AdDisclaimer />
      {guide.parent_id && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
          <span>문구 검토에서 대체 표현으로 고친 문구를 반영한 수정본이에요. 고치기 전 버전과 그 검사 기록은 목록에서만 숨기고 그대로 남아 있어요.</span>
          <Link href={`/ad-check/guide/history/${guide.parent_id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            이전 버전 보기
          </Link>
        </div>
      )}
      {revisions[0] && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
          <span>이전 버전이에요 (목록에서는 숨겨져 있어요). 이 가이드를 고친 수정본이 {revisions.length}개 있어요. 게시에는 최신 수정본을 쓰세요.</span>
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
        {/* 이 가이드의 검토: 검토 기록 목록에서 뺀 묶음 (문구 검토 · 만들 때 자동 검사 · 버전) */}
        {record && (record.phrases.length > 0 || record.autoChecks.length > 0 || record.versions.length > 1) && (
          <section className="space-y-2 rounded-lg border p-4 text-sm">
            <h2 className="font-semibold">이 가이드의 검토</h2>
            <ul className="space-y-1.5">
              {record.phrases.map(({ check, reflected }) => {
                const [first, ...rest] = koLines(check);
                return (
                  <li key={check.id}>
                    <Link href={`/ad-check/${check.id}`} className="flex flex-wrap items-center gap-2 underline-offset-4 hover:underline">
                      <span className="shrink-0 text-xs text-muted-foreground">문구 검토</span>
                      <span className="min-w-0 truncate">{first?.text ?? ""}</span>
                      {rest.length > 0 && <span className="shrink-0 text-xs text-muted-foreground">외 {rest.length}줄</span>}
                      {check.overall_action && <ActionBadge action={check.overall_action} />}
                      <span className={`shrink-0 text-xs ${reflected ? "text-muted-foreground" : "text-primary"}`}>{reflected ? "반영됨" : "반영 전"}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatDate(check.created_at)}</span>
                    </Link>
                  </li>
                );
              })}
              {record.autoChecks.map((a) => (
                <li key={a.checkId}>
                  <Link href={`/ad-check/${a.checkId}`} className="text-muted-foreground underline-offset-4 hover:underline">
                    자동 검사 · v{a.version} (만들 때)
                  </Link>
                </li>
              ))}
              {record.versions.length > 1 &&
                record.versions.map((v, i) =>
                  v.id === guide.id ? null : (
                    <li key={v.id}>
                      <Link href={`/ad-check/guide/history/${v.id}`} className="text-muted-foreground underline-offset-4 hover:underline">
                        {i === record.versions.length - 1 ? "최신 버전" : "이전 버전"} · v{i + 1} ({formatDate(v.created_at)})
                      </Link>
                    </li>
                  ),
                )}
            </ul>
          </section>
        )}
        <AiResultMeta model={guide.model} promptVersion={guide.prompt_version} createdAt={guide.created_at} />
      </div>
    </>
  );
}
