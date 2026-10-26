import Link from "next/link";
import { SubmissionSection } from "@/components/common/submission-section";
import { ViewStateGate } from "@/components/common/view-state";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { getProduct } from "@/lib/data";
import { getReviewDraftState } from "@/lib/data/review-draft";
import { getReviewProductList } from "@/lib/data/reviews";
import { saveReviewDraft } from "@/lib/data/submission-actions";
import { buildReviewSnapshot } from "@/lib/data/submission-bodies";
import { SKIN_LINE_LABEL, VERDICT_LABEL } from "../_lib/topics";
import { SummaryCard } from "./summary-card";

const STEPS = [
  ["1 소구점 · 후기 담기", "소구점 찾기 · 상세페이지용 리뷰에서"],
  ["2 한 줄 결론 쓰기", "오른쪽 시안 패널에서"],
  ["3 결재 올리기", "제출하면 고칠 수 없어요"],
  ["4 팀장 승인", "승인된 후기를 가이드가 가져가요"],
] as const;

export default async function ReviewSummaryPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const query = await searchParams;
  // 판매 중 제품이 먼저, 그 안에서는 자사 제품 순서 (Deep Skin → Core Essence, getReviewProductList가 정렬)
  const own = (await getReviewProductList())
    .filter((p) => p.kind === "own")
    .toSorted((a, b) => Number(b.saleStatus === "on_sale") - Number(a.saleStatus === "on_sale"));
  // 제품은 위아래로 쌓지 않고 버튼으로 하나씩 본다 (?product=<제품 id>, 없으면 첫 제품)
  const selected = own.find((p) => p.id === query.product) ?? own[0];

  const view = selected
    ? await (async () => {
        const product = await getProduct(selected.id);
        const onSale = product?.sale_status === "on_sale" && Boolean(product.project_id);
        // 판매 중인 제품만 시안 대상이다. 개발 중 제품은 숫자만 보여 주고 시안 패널은 붙이지 않는다
        const [snapshot, draft] = await Promise.all([buildReviewSnapshot(selected.id), onSale ? getReviewDraftState(selected.id) : null]);
        return { product, onSale, body: snapshot.body, draft };
      })()
    : null;

  return (
    <>
      <PageHeader
        title="리뷰 분석 요약"
        description="제품별 결과를 한 장으로 요약해 팀장에게 결재를 올려요. 결재된 시안은 콘텐츠 제작 가이드와 AI 분석이 가져다 써요"
        featureId="E"
      />
      <ViewStateGate state={!selected || !view ? "empty" : "ready"} emptyAction="자사 제품이 없어요. 프로젝트에 자사 제품을 먼저 등록해 주세요.">
        {selected && view && (
          <>
            <ol className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map(([title, sub]) => (
                <li key={title} className="rounded-lg border bg-card px-4 py-2.5 text-sm">
                  <b>{title}</b>
                  <span className="block text-xs text-muted-foreground">{sub}</span>
                </li>
              ))}
            </ol>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">자사 제품</span>
              {own.map((p) => (
                <Link
                  key={p.id}
                  href={`/reviews/summary?product=${p.id}`}
                  scroll={false}
                  aria-current={p.id === selected.id ? "page" : undefined}
                  className={buttonVariants({ variant: p.id === selected.id ? "default" : "outline" })}
                >
                  {p.name.replace(/^Leaf& Dew /, "")}
                </Link>
              ))}
            </div>

            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
              <SummaryCard
                productId={selected.id}
                name={selected.name}
                skinLine={selected.skinLine ? SKIN_LINE_LABEL[selected.skinLine] : null}
                onSale={view.onSale}
                body={view.body}
                draft={
                  view.draft
                    ? {
                        versionNo: view.draft.versionNo,
                        status: view.draft.status,
                        appeals: view.draft.body?.appeals ?? [],
                        translations: view.draft.body?.translations ?? [],
                      }
                    : null
                }
                verdictLabel={VERDICT_LABEL}
              />
              <aside className="min-w-0">
                {view.product && view.onSale ? (
                  <SubmissionSection
                    tab="review"
                    product={view.product}
                    saveDraft={saveReviewDraft.bind(null, selected.id)}
                    snapshotNote="지금 리포트의 주제별 성적표 · 불만 · 재구매 요인과 왼쪽에 담은 소구점 · 일본어 후기를 그대로 저장해요. 제출하면 고칠 수 없어요."
                    className="mt-0"
                  />
                ) : (
                  <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
                    판매 중인 자사 제품만 시안을 올릴 수 있어요. 개발 중 제품은 판매를 시작하면 들어와요.{" "}
                    <Link href={`/reviews/${selected.id}`} className={buttonVariants({ variant: "link", size: "sm" })}>
                      리포트 보기 →
                    </Link>
                  </p>
                )}
              </aside>
            </div>
          </>
        )}
      </ViewStateGate>
    </>
  );
}
