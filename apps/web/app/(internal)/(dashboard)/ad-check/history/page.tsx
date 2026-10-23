import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { DataTableTemplate } from "@/components/templates";
import { buttonVariants } from "@/components/ui/button";
import { getAdChecks, getMembers, getProducts } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { ReviewStatus } from "@/lib/schemas/common";
import { ActionBadge, ReviewStateBadge, STATUS_LABEL, USAGE_LABEL } from "../_components/ad-badges";
import { HistoryFilters } from "../_components/history-filters";

type HistoryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdCheckHistoryPage({ searchParams }: HistoryPageProps) {
  const query = await searchParams;
  const parsed = ReviewStatus.safeParse(query.status);
  const status = parsed.success ? parsed.data : undefined;
  const productFilter = typeof query.product === "string" ? query.product : undefined;
  const [all, members, products] = await Promise.all([getAdChecks(), getMembers(), getProducts()]);
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
      <div className="flex flex-wrap items-start justify-between gap-2">
        <PageHeader title="검토 내역" description="원문, 수정 제안, 담당자 검토 결과" featureId="A" />
        <Link href="/ad-check" className={buttonVariants()}>
          새 검토
        </Link>
      </div>
      <DataTableTemplate
        emptyAction="새 검토 시작하기"
        filters={
          <HistoryFilters products={productOptions} statuses={ReviewStatus.options.map((v) => ({ value: v, label: STATUS_LABEL[v] }))} />
        }
        columns={[
          { key: "text", label: "문구" },
          { key: "product", label: "제품 · 사용처" },
          { key: "action", label: "판정" },
          { key: "status", label: "상태" },
          { key: "reviewer", label: "검토자" },
          { key: "date", label: "요청일" },
        ]}
        rows={checks.map((c) => {
          const [first, ...rest] = c.input_text.split("\n");
          return {
            id: c.id,
            href: `/ad-check/${c.id}`,
            cells: {
              text: (
                // 긴 문구는 한 줄로 자르고 전체는 title로 보여준다
                <span lang={c.input_lang} title={c.input_text} className="flex max-w-80 gap-1">
                  <span className="truncate">{first}</span>
                  {rest.length > 0 && <span className="shrink-0 text-muted-foreground">외 {rest.length}줄</span>}
                </span>
              ),
              product: (
                <span className="block max-w-56 truncate" title={productName(c.product_id)}>
                  {productName(c.product_id)} · {c.usage ? USAGE_LABEL[c.usage] : "—"}
                </span>
              ),
              action: c.overall_action ? <ActionBadge action={c.overall_action} /> : "—",
              status: <ReviewStateBadge status={c.review_status} expertRequested={c.is_expert_review_requested} />,
              reviewer: memberName(c.reviewer_id),
              date: formatDate(c.created_at),
            },
          };
        })}
      />
    </>
  );
}
