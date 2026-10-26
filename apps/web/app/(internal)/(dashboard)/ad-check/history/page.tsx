import Link from "next/link";
import { EmptyState } from "@/components/common/states";
import { PageHeader } from "@/components/layout/page-header";
import { DataTableTemplate } from "@/components/templates";
import { buttonVariants } from "@/components/ui/button";
import { getAdChecks, getMembers, getProducts, getReviewTranslationCheckIds } from "@/lib/data";
import { getMyWorkspace } from "@/lib/data/workspace";
import { formatDate } from "@/lib/format";
import { ReviewStatus } from "@/lib/schemas/common";
import { ActionBadge, ReviewStateBadge, STATUS_LABEL, USAGE_LABEL } from "../_components/ad-badges";
import { DeleteButton } from "../_components/delete-button";
import { HistoryFilters } from "../_components/history-filters";
import { koLines } from "../_lib/ko-lines";

type HistoryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdCheckHistoryPage({ searchParams }: HistoryPageProps) {
  const query = await searchParams;
  const parsed = ReviewStatus.safeParse(query.status);
  const status = parsed.success ? parsed.data : undefined;
  const productFilter = typeof query.product === "string" ? query.product : undefined;
  // 종류: 직접 한 검토 / 리뷰 탭의 상세페이지용 리뷰 번역이 만든 검토 (번역 한 건마다 검토 한 건이 쌓인다)
  const kindFilter = query.kind === "manual" || query.kind === "review" ? query.kind : undefined;
  const [all, members, products, mine, reviewCheckIds] = await Promise.all([getAdChecks(), getMembers(), getProducts(), getMyWorkspace().catch(() => null), getReviewTranslationCheckIds()]);
  // 삭제(숨김)는 owner(팀장)만. 팀원 화면에는 버튼을 그리지 않는다
  const isOwner = mine?.role === "owner";
  const checks = all
    .filter((c) => (!status || c.review_status === status) && (!productFilter || c.product_id === productFilter))
    .filter((c) => !kindFilter || (kindFilter === "review") === reviewCheckIds.has(c.id))
    .toSorted((a, b) => b.created_at.localeCompare(a.created_at));
  const memberName = (id: string | null) => members.find((m) => m.user_id === id)?.display_name ?? "—";
  const productName = (id: string | undefined) => products.find((p) => p.id === id)?.name ?? "—";
  // 검토 내역이 있는 제품만 고를 수 있게 한다
  const productOptions = products
    .filter((p) => all.some((c) => c.product_id === p.id) || p.id === productFilter)
    .map((p) => ({ value: p.id, label: p.name }));

  return (
    <>
      <PageHeader title="검토 이력" description="원문, 수정 제안, 담당자 검토 결과" featureId="A" />
      {/* 결과가 없을 때도 필터를 남겨 다른 조건으로 바꿀 수 있게, 필터는 표 템플릿 밖에 둔다 */}
      <div className="mb-4">
        <HistoryFilters
          filters={[
            { key: "product", label: "제품", options: productOptions },
            { key: "status", label: "검토 상태", options: ReviewStatus.options.map((v) => ({ value: v, label: STATUS_LABEL[v] })) },
            { key: "kind", label: "종류", options: [{ value: "manual", label: "직접 검토" }, { value: "review", label: "리뷰 번역" }] },
          ]}
        />
      </div>
      {checks.length === 0 ? (
        <EmptyState message="조건에 맞는 검토 이력이 없습니다" action="필터를 바꾸거나 「전체」를 골라 보세요" />
      ) : (
        <DataTableTemplate
          columns={[
            { key: "text", label: "문구" },
            { key: "product", label: "제품" },
            { key: "usage", label: "용도" },
            { key: "action", label: "판정" },
            { key: "status", label: "상태" },
            { key: "author", label: "작성자" },
            { key: "reviewer", label: "검토자" },
            { key: "date", label: "요청일" },
            { key: "detail", label: "" },
            ...(isOwner ? [{ key: "delete", label: "" }] : []),
          ]}
          rows={checks.map((c) => {
            // 목록 문구는 한국어로 통일한다 (줄마다 일본어 줄은 번역, 번역이 없으면 원문에 「일본어」 표시). 마우스를 올리면 첫 줄 원문
            const [first, ...rest] = koLines(c);
            return {
              id: c.id,
              href: `/ad-check/${c.id}`, // 문구를 누르면 상세(두괄식 결과), 고쳐서 다시 판정은 맨 끝 「재검토」
              cells: {
                text: (
                  // 긴 문구는 한 줄로 자르고 전체는 title로 보여준다
                  <span title={first?.original} className="flex max-w-80 items-center gap-1">
                    {first?.untranslated && <span className="shrink-0 rounded border px-1 text-[0.65rem] text-muted-foreground">일본어</span>}
                    {/* 표 템플릿의 링크 밑줄이 잘린 글자(truncate)까지 내려오지 않아서, 링크에 커서를 올리면 여기서 밑줄을 긋는다 */}
                    <span lang={first?.untranslated ? "ja" : "ko"} className="truncate font-medium underline-offset-4 [a:hover_&]:underline">
                      {first?.text ?? ""}
                    </span>
                    {rest.length > 0 && <span className="shrink-0 text-muted-foreground">외 {rest.length}줄</span>}
                  </span>
                ),
                product: (
                  <span className="block max-w-44 truncate" title={productName(c.product_id)}>
                    {productName(c.product_id)}
                  </span>
                ),
                // 리뷰 번역 검토는 「리뷰」로 표시한다 (DB 용도는 detail_page 그대로, 마우스를 올리면 설명)
                usage: reviewCheckIds.has(c.id) ? (
                  <span className="whitespace-nowrap rounded border px-1.5 text-xs" title="리뷰 분석 탭의 상세페이지용 리뷰 번역 검토">
                    리뷰
                  </span>
                ) : (
                  <span className="whitespace-nowrap">{c.usage ? USAGE_LABEL[c.usage] : "—"}</span>
                ),
                action: c.overall_action ? <ActionBadge action={c.overall_action} /> : "—",
                status: <ReviewStateBadge status={c.review_status} expertRequested={c.is_expert_review_requested} />,
                author: memberName(c.created_by ?? null),
                reviewer: memberName(c.reviewer_id),
                date: formatDate(c.created_at),
                detail: (
                  <Link href={`/ad-check?from=${c.id}`} className={`${buttonVariants({ variant: "outline", size: "sm" })} border-foreground/40!`}>
                    재검토
                  </Link>
                ),
                delete: <DeleteButton endpoint={`/api/ad-check/${c.id}`} confirmMessage="이 검토를 목록에서 삭제할까요? 기록은 증거용으로 DB에 남습니다." />,
              },
            };
          })}
        />
      )}
    </>
  );
}
