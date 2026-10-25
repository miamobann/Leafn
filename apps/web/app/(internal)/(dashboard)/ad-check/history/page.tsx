import Link from "next/link";
import { EmptyState } from "@/components/common/states";
import { PageHeader } from "@/components/layout/page-header";
import { DataTableTemplate } from "@/components/templates";
import { buttonVariants } from "@/components/ui/button";
import { getAdChecks, getMembers, getProducts } from "@/lib/data";
import { getMyWorkspace } from "@/lib/data/workspace";
import { formatDate } from "@/lib/format";
import { ReviewStatus } from "@/lib/schemas/common";
import { ActionBadge, ReviewStateBadge, STATUS_LABEL, USAGE_LABEL } from "../_components/ad-badges";
import { DeleteButton } from "../_components/delete-button";
import { HistoryFilters } from "../_components/history-filters";

/** 출처: 직접 한 검토가 기본. 콘텐츠 가이드 검사는 보기만 한다 (승인 대상 아님) */
const SOURCES = [
  { value: "manual", label: "직접 검토" },
  { value: "content_guide", label: "콘텐츠 가이드 검사" },
] as const;

type HistoryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdCheckHistoryPage({ searchParams }: HistoryPageProps) {
  const query = await searchParams;
  const parsed = ReviewStatus.safeParse(query.status);
  const source = query.source === "content_guide" ? "content_guide" : "manual";
  const isGuide = source === "content_guide";
  const status = parsed.success && !isGuide ? parsed.data : undefined;
  const productFilter = typeof query.product === "string" ? query.product : undefined;
  const [all, members, products, mine] = await Promise.all([getAdChecks({ source }), getMembers(), getProducts(), getMyWorkspace().catch(() => null)]);
  // 삭제(숨김)는 owner(팀장)만. 팀원 화면에는 버튼을 그리지 않는다
  const isOwner = mine?.role === "owner";
  const checks = all
    .filter((c) => (!status || c.review_status === status) && (!productFilter || c.product_id === productFilter))
    .toSorted((a, b) => b.created_at.localeCompare(a.created_at));
  const memberName = (id: string | null) => members.find((m) => m.user_id === id)?.display_name ?? "—";
  const productName = (id: string | undefined) => products.find((p) => p.id === id)?.name ?? "—";
  // 검토 내역이 있는 제품만 고를 수 있게 한다
  const productOptions = products
    .filter((p) => all.some((c) => c.product_id === p.id) || p.id === productFilter)
    .map((p) => ({ value: p.id, label: p.name }));

  return (
    <>
      <PageHeader title="검토 내역" description="원문, 수정 제안, 담당자 검토 결과" featureId="A" />
      {/* 결과가 없을 때도 필터를 남겨 다른 조건으로 바꿀 수 있게, 필터는 표 템플릿 밖에 둔다 */}
      <div className="mb-4">
        <HistoryFilters
          filters={[
            { key: "source", label: "출처", options: [...SOURCES], allLabel: null },
            { key: "product", label: "제품", options: productOptions },
            ...(isGuide ? [] : [{ key: "status", label: "검토 상태", options: ReviewStatus.options.map((v) => ({ value: v, label: STATUS_LABEL[v] })) }]),
          ]}
        />
      </div>
      {checks.length === 0 ? (
        <EmptyState message="조건에 맞는 검토 내역이 없습니다" action="필터를 바꾸거나 「전체」를 골라 보세요" />
      ) : (
        <DataTableTemplate
          columns={[
            { key: "text", label: "문구" },
            { key: "product", label: "제품 · 사용처" },
            { key: "action", label: "판정" },
            // 콘텐츠 가이드 검사는 승인 대상이 아니라 상태·검토자·수정 칸을 뺀다
            ...(isGuide ? [] : [{ key: "status", label: "상태" }, { key: "reviewer", label: "검토자" }]),
            { key: "date", label: "요청일" },
            ...(isGuide ? [] : [{ key: "detail", label: "" }]),
            ...(isOwner ? [{ key: "delete", label: "" }] : []),
          ]}
          rows={checks.map((c) => {
            // 목록 문구는 한국어로 통일한다 (일본어 입력은 한국어 번역, 번역이 없으면 원문)
            const koText = c.input_lang === "ko" ? c.input_text : (c.back_translation_ko ?? c.input_text);
            const koLang = c.input_lang === "ko" || c.back_translation_ko ? "ko" : c.input_lang;
            const [first, ...rest] = koText.split("\n");
            return {
              id: c.id,
              href: `/ad-check/${c.id}`, // 문구를 누르면 상세(두괄식 결과), 고치기는 맨 끝 「수정」
              cells: {
                text: (
                  // 긴 문구는 한 줄로 자르고 전체는 title로 보여준다
                  <span lang={koLang} title={koText} className="flex max-w-80 gap-1">
                    {/* 표 템플릿의 링크 밑줄이 잘린 글자(truncate)까지 내려오지 않아서, 링크에 커서를 올리면 여기서 밑줄을 긋는다 */}
                    <span className="truncate font-medium underline-offset-4 [a:hover_&]:underline">{first}</span>
                    {rest.length > 0 && <span className="shrink-0 text-muted-foreground">외 {rest.length}줄</span>}
                  </span>
                ),
                product: (
                  <span className="block max-w-44 truncate" title={productName(c.product_id)}>
                    {productName(c.product_id)} · {c.usage ? USAGE_LABEL[c.usage] : "—"}
                  </span>
                ),
                action: c.overall_action ? <ActionBadge action={c.overall_action} /> : "—",
                status: <ReviewStateBadge status={c.review_status} expertRequested={c.is_expert_review_requested} />,
                reviewer: memberName(c.reviewer_id),
                date: formatDate(c.created_at),
                detail: (
                  <Link href={`/ad-check?from=${c.id}`} className={`${buttonVariants({ variant: "outline", size: "sm" })} border-foreground/40!`}>
                    수정
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
