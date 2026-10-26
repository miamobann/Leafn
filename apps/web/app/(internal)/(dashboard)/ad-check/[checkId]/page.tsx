import Link from "next/link";
import { notFound } from "next/navigation";
import { AiResultMeta } from "@/components/common/ai";
import { SubmissionSection } from "@/components/common/submission-section";
import { PageHeader } from "@/components/layout/page-header";
import { DetailTemplate } from "@/components/templates";
import { buttonVariants } from "@/components/ui/button";
import { getAdCheck, getAdChecks, getContentGuides, getMemberName, getProduct } from "@/lib/data";
import { saveAdDraft } from "@/lib/data/submission-actions";
import { getMyWorkspace, isSupabaseConfigured } from "@/lib/data/workspace";
import { formatDate } from "@/lib/format";
import { ActionBadge, ReviewStateBadge, USAGE_LABEL } from "../_components/ad-badges";
import { CopyButton } from "../_components/copy-button";
import { DetailReviewBar } from "../_components/detail-review-bar";
import { GuideReflect } from "../_components/guide-reflect";
import { guideReflectState, guideSlots } from "../_lib/guide-to-review";
import { makeFill } from "../_lib/guide-report";
import { getAdProducts } from "@/lib/data/ad-products";
import { LineResultCard } from "../_components/line-result-card";
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
    check.content_guide_id ? getContentGuides() : [],
  ]);
  // 만든 가이드에서 온 검토: 누구나(팀장이 팀원 검토를 이어받아도) 대체 표현을 골라 「이 가이드에 반영」
  const fromGuide = check.content_guide_id ? guides.find((g) => g.id === check.content_guide_id) : undefined;
  const reflectState = fromGuide ? guideReflectState(guides, fromGuide.id, check.id) : null;
  // 이미 반영된 검토(팀원이 반영까지 하고 물어본 경우): 팀장이 승인할 때 최종 문구가 실제 가이드 문구와 같도록 수정본 문구로 미리 채운다.
  // 팀장이 아직 정하지 않았고 최종 문구가 처음 그대로일 때만
  const revision = reflectState?.kind === "reflected" ? guides.find((g) => g.id === reflectState.revisionId) : undefined;
  const adProducts = revision ? await getAdProducts() : [];
  const revisionProduct = adProducts.find((p) => p.id === revision?.product_id);
  const reflectedText =
    revision && check.review_status === "pending" && (check.final_text ?? check.input_text) === check.input_text
      ? guideSlots(revision, revisionProduct ? makeFill(revisionProduct) : undefined).map((s) => s.text).join("\n")
      : null;
  // 최종 문구의 n번째 줄이 판정한 원문 그대로인 「고쳐야 함」 줄 수 (대체 표현을 고르면 줄이 바뀐다)
  const mustFixLeftIn = (finalText: string) => {
    const finalLines = finalText.split("\n");
    return (check.line_results ?? []).filter((l, i) => l.action === "must_fix" && (finalLines[i] ?? "").trim() === l.original.trim()).length;
  };
  const canApprove = !isSupabaseConfigured() || mine?.role === "owner";
  // 콘텐츠 가이드 검사는 보기만 한다 (승인 대상이 아니라 검토 칸을 그리지 않는다)
  const isGuideCheck = !manual.some((c) => c.id === check.id);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <PageHeader title="검토 상세" featureId="A" />
        <span className="flex flex-wrap gap-2">
          {/* 결재는 아래 「시안 · 결재」 패널에서 올린다. 팀장 결재함에는 시안으로 올린 건만 들어간다 */}
          {!isGuideCheck && product?.kind === "own" && product.sale_status === "on_sale" && (
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
            만든 가이드 「{fromGuide.title.title_ko}」에서 온 검토예요.{reflectState?.kind === "ready" ? " 아래에서 대체 표현을 고르고 「가이드에 반영」을 누르면 가이드가 고쳐져요." : ""}
          </span>
          <Link href={`/ad-check/guide/history/${fromGuide.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            가이드 보기
          </Link>
        </div>
      )}
      <div className="mt-4">
        <DetailTemplate
          badges={
            <>
              <ReviewStateBadge status={check.review_status} expertRequested={check.is_expert_review_requested} />
              {check.overall_action && <ActionBadge action={check.overall_action} />}
            </>
          }
          attributes={[
            // 최종 문구를 먼저, 원문은 그 아래 (일본어 원문은 연한 글씨로 한국어 번역을 덧붙인다)
            {
              label: "최종 문구",
              value: check.final_text ? (
                <span className="flex flex-wrap items-start gap-2">
                  <span className="whitespace-pre-line">{check.final_text}</span>
                  <CopyButton text={check.final_text} label="최종 문구 복사" />
                </span>
              ) : (
                "—"
              ),
            },
            {
              label: "원문",
              value: (
                <span className="block space-y-1">
                  <span className="block whitespace-pre-line" lang={check.input_lang}>
                    {check.input_text}
                  </span>
                  {check.input_lang === "ja" && check.back_translation_ko && (
                    <span className="block whitespace-pre-line text-muted-foreground">한국어: {check.back_translation_ko}</span>
                  )}
                </span>
              ),
            },
            { label: "제품", value: product?.name ?? "—" },
            { label: "용도", value: check.usage ? USAGE_LABEL[check.usage] : "—" },
            { label: "검토자", value: reviewer },
            { label: "검토일", value: check.reviewed_at ? formatDate(check.reviewed_at) : "—" },
            { label: "메모", value: check.reviewer_note ?? "—" },
          ]}
          sections={[
            {
              title: "줄별 판정",
              content: (
                <div className="space-y-4">
                  <ResultSummary check={check} />
                  {fromGuide && reflectState ? (
                    <GuideReflect guideId={fromGuide.id} checkId={check.id} lines={check.line_results ?? []} findings={check.findings} state={reflectState} />
                  ) : (
                    (check.line_results ?? []).map((line) => (
                      <LineResultCard
                        key={line.line_index}
                        line={line}
                        findings={check.findings.filter((f) => f.line_index === line.line_index)}
                      />
                    ))
                  )}
                  <AiResultMeta model={check.model} promptVersion={check.prompt_version} createdAt={check.created_at} />
                </div>
              ),
            },
          ]}
        />
        {isGuideCheck ? (
          <p className="mt-4 text-sm text-muted-foreground">콘텐츠 제작에서 자동으로 돌린 「콘텐츠 문구 자동 검사」예요. 승인·반려 대상이 아니라 보기만 할 수 있어요.</p>
        ) : (
        <>
        {reflectedText && (
          <p className="mt-4 rounded-lg border p-3 text-sm">가이드에 반영한 문구로 최종 문구를 채워 두었어요. 승인하면 이 문구로 저장돼요.</p>
        )}
        <DetailReviewBar
          checkId={check.id}
          initialFinalText={reflectedText ?? check.final_text ?? check.input_text}
          mustFixLeft={mustFixLeftIn(reflectedText ?? check.final_text ?? check.input_text)}
          initialNote={check.reviewer_note ?? ""}
          initialStatus={check.review_status}
          initialExpertRequested={check.is_expert_review_requested ?? false}
          canApprove={canApprove}
        />
        </>
        )}
        {/* 제품에 연결된 직접 검토만 시안에 담는다 (docs/team-approval-ai-analysis.md 7장 2단계) */}
        {!isGuideCheck && product && (
          <SubmissionSection
            tab="ad"
            product={product}
            saveDraft={saveAdDraft.bind(null, product.id, check.id)}
            snapshotNote="이 검토 건의 판정과 최종 문구를 시안에 담아요. 시안 결재는 이 검토 건의 담당자 검토 상태(승인 · 반려)와 따로 기록돼요."
            carryOverLabel="직전 버전에 담긴 다른 문구도 함께 담기"
          />
        )}
      </div>
    </>
  );
}
