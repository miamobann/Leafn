import Link from "next/link";
import { notFound } from "next/navigation";
import { AiResultMeta } from "@/components/common/ai";
import { SubmissionSection } from "@/components/common/submission-section";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdCheck, getAdChecks, getContentGuides, getMemberName, getProduct } from "@/lib/data";
import { saveAdDraft } from "@/lib/data/submission-actions";
import { getMyWorkspace, isSupabaseConfigured } from "@/lib/data/workspace";
import { formatDate } from "@/lib/format";
import { ReviewStateBadge, USAGE_LABEL } from "../_components/ad-badges";
import { CopyButton } from "../_components/copy-button";
import { DetailReviewBar } from "../_components/detail-review-bar";
import { GuideReflect } from "../_components/guide-reflect";
import { findSourceGuide, guideReflectState } from "../_lib/guide-to-review";
import { makeFill } from "../_lib/guide-report";
import { getAdProducts } from "@/lib/data/ad-products";
import { ResultLines } from "../_components/result-lines";
import { ResultSummary } from "../_components/result-summary";
import { AdDisclaimer } from "../_components/ad-disclaimer";

export default async function AdCheckDetailPage({ params }: { params: Promise<{ checkId: string }> }) {
  const check = await getAdCheck((await params).checkId);
  if (!check) notFound();
  const [manual, reviewer, product, mine, guides] = await Promise.all([
    getAdChecks(),
    getMemberName(check.reviewer_id),
    check.product_id ? getProduct(check.product_id) : null,
    isSupabaseConfigured() ? getMyWorkspace() : null,
    getContentGuides(),
  ]);
  const adProducts = guides.length ? await getAdProducts() : [];
  const fillFor = (productId: string | null) => {
    const p = adProducts.find((x) => x.id === productId);
    return p ? makeFill(p) : undefined;
  };
  // 만든 가이드에서 온 검토: 누구나(팀장이 팀원 검토를 이어받아도) 대체 표현을 골라 「이 가이드에 반영」.
  // 연결 칸이 비어 있으면(연결 기능 전 검토 · DB 적용 전) 문구가 같은 가이드를 찾는다 (직접 쓴 검토는 걸리지 않는다)
  const fromGuide = manual.some((c) => c.id === check.id) ? findSourceGuide(check, guides, fillFor) : undefined;
  const reflectState = fromGuide ? guideReflectState(guides, fromGuide.id, check.id) : null;
  const guideProduct = adProducts.find((p) => p.id === fromGuide?.product_id);
  const guideTitle = fromGuide ? (guideProduct ? makeFill(guideProduct)(fromGuide.title.title_ko) : fromGuide.title.title_ko) : "";
  // 콘텐츠 가이드 검사는 보기만 한다 (승인 대상이 아니라 검토 칸을 그리지 않는다)
  const isGuideCheck = !manual.some((c) => c.id === check.id);
  const canSubmit = product?.kind === "own" && product.sale_status === "on_sale";
  // 결론 칸의 「다음 할 일」
  const nextStep = isGuideCheck
    ? "콘텐츠 가이드 자동 검사라 보기만 해요. 고치려면 만든 가이드에서 「이 문구로 새 검토」를 해요."
    : [
        fromGuide && reflectState?.kind === "ready" ? "① 대체 표현 고르기 → ② 「가이드에 반영」" : null,
        fromGuide && reflectState?.kind === "reflected" ? "가이드에 반영됨" : null,
        fromGuide && reflectState?.kind === "stale" ? "최신 수정본에서 다시 검토" : null,
        canSubmit ? "아래 「시안 · 결재」에서 결재 올리기" : null,
      ]
        .filter(Boolean)
        .join(" → ") || "고칠 곳을 확인하고 필요하면 「이 내용으로 재검토」";
  const canApprove = !isSupabaseConfigured() || mine?.role === "owner";

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <PageHeader title="검토 상세" featureId="A" />
        <span className="flex flex-wrap gap-2">
          {/* 결재는 아래 「시안 · 결재」 패널에서 올린다. 팀장 결재함에는 시안으로 올린 건만 들어간다 */}
          {!isGuideCheck && canSubmit && (
            <Link href="#submission" className={buttonVariants({ variant: "outline" })}>
              시안으로 결재 올리기 ↓
            </Link>
          )}
          <Link href={`/ad-check?from=${check.id}`} className={buttonVariants()}>
            이 내용으로 재검토
          </Link>
        </span>
      </div>
      <AdDisclaimer />
      {fromGuide && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
          <span>
            만든 가이드 「{guideTitle}」에서 온 검토예요.{reflectState?.kind === "ready" ? " 아래에서 대체 표현을 고르고 「가이드에 반영」을 누르면 가이드가 고쳐져요." : ""}
          </span>
          <Link href={`/ad-check/guide/history/${fromGuide.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            가이드 보기
          </Link>
        </div>
      )}
      {/* 읽는 순서 (2026-10-27 UI 정리): 결론 · 다음 할 일 → 문제 줄 (문제 없는 줄은 접음) → 원문 · 최종 문구 (접음) → 메모 → 시안 · 결재 */}
      <div className="mt-4 space-y-4">
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {(check.review_status !== "pending" || check.is_expert_review_requested) && (
            <ReviewStateBadge status={check.review_status} expertRequested={check.is_expert_review_requested} />
          )}
          <span>{product?.name ?? "제품 없음"}</span>·<span>{check.usage ? USAGE_LABEL[check.usage] : "용도 없음"}</span>·<span>{formatDate(check.created_at)} 검토</span>
          {check.reviewed_at && (
            <>
              ·<span>
                {reviewer} {formatDate(check.reviewed_at)} 확인
              </span>
            </>
          )}
        </p>
        <ResultSummary check={check} next={<p className="text-sm"><span className="font-medium">다음 할 일 · </span>{nextStep}</p>} />
        <Card>
          <CardHeader>
            <CardTitle>줄별 판정</CardTitle>
          </CardHeader>
          <CardContent>
            {fromGuide && reflectState ? (
              <GuideReflect guideId={fromGuide.id} checkId={check.id} lines={check.line_results ?? []} findings={check.findings} state={reflectState} />
            ) : (
              <ResultLines lines={check.line_results ?? []} findings={check.findings} />
            )}
          </CardContent>
        </Card>
        <details className="rounded-lg border p-4 text-sm">
          <summary className="cursor-pointer font-medium">원문 · 최종 문구 전체 보기</summary>
          <div className="mt-3 space-y-4">
            <section>
              <p className="mb-1 flex flex-wrap items-center justify-between gap-2 font-medium">
                최종 문구 {check.final_text && <CopyButton text={check.final_text} label="최종 문구 복사" />}
              </p>
              <p className="whitespace-pre-line rounded-md bg-muted p-3 leading-relaxed">{check.final_text ?? "—"}</p>
            </section>
            <section>
              <p className="mb-1 font-medium">원문</p>
              <p className="whitespace-pre-line rounded-md bg-muted p-3 leading-relaxed" lang={check.input_lang}>
                {check.input_text}
              </p>
              {check.input_lang === "ja" && check.back_translation_ko && <p className="mt-2 whitespace-pre-line text-muted-foreground">한국어: {check.back_translation_ko}</p>}
            </section>
          </div>
        </details>
        {isGuideCheck ? (
          <p className="text-sm text-muted-foreground">콘텐츠 제작에서 자동으로 돌린 「콘텐츠 문구 자동 검사」예요. 보기만 할 수 있어요.</p>
        ) : (
          <DetailReviewBar
            checkId={check.id}
            initialFinalText={check.final_text ?? check.input_text}
            initialNote={check.reviewer_note ?? ""}
            initialStatus={check.review_status}
            initialExpertRequested={check.is_expert_review_requested ?? false}
            canApprove={canApprove}
          />
        )}
        {/* 제품에 연결된 직접 검토만 시안에 담는다 (docs/team-approval-ai-analysis.md 7장 2단계) */}
        {!isGuideCheck && product && (
          <SubmissionSection
            tab="ad"
            product={product}
            saveDraft={saveAdDraft.bind(null, product.id, check.id)}
            snapshotNote="이 검토 건의 판정과 최종 문구를 시안에 담아요. 팀장이 결재함에서 승인 · 반려해요."
            carryOverLabel="직전 버전에 담긴 다른 문구도 함께 담기"
          />
        )}
        <AiResultMeta model={check.model} promptVersion={check.prompt_version} createdAt={check.created_at} />
      </div>
    </>
  );
}
