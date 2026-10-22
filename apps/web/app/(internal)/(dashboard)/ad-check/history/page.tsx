import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { DataTableTemplate } from "@/components/templates";
import { getMembers } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { ReviewStatus } from "@/lib/schemas/common";
import { ActionBadge, ReviewStateBadge, STATUS_LABEL, USAGE_LABEL } from "../_components/ad-badges";
import { getLabAdChecks, getLabProducts } from "../_lib/data";

type HistoryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdCheckHistoryPage({ searchParams }: HistoryPageProps) {
  const parsed = ReviewStatus.safeParse((await searchParams).status);
  const status = parsed.success ? parsed.data : undefined;
  const [checks, members, products] = await Promise.all([getLabAdChecks({ status }), getMembers(), getLabProducts()]);
  const memberName = (id: string | null) => members.find((m) => m.user_id === id)?.display_name ?? "—";
  const productName = (id: string | undefined) => products.find((p) => p.id === id)?.name_ko ?? "—";

  const filters = [
    { label: "전체", href: "/ad-check/history", active: !status },
    ...ReviewStatus.options.map((s) => ({ label: STATUS_LABEL[s], href: `/ad-check/history?status=${s}`, active: status === s })),
  ];

  return (
    <>
      <PageHeader title="검토 이력" description="원문, 수정 제안, 담당자 검토 결과" featureId="A" />
      <DataTableTemplate
        emptyAction="새 검토 시작하기"
        filters={
          <nav aria-label="검토 상태 필터" className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <Link
                key={f.href}
                href={f.href}
                aria-current={f.active ? "page" : undefined}
                className={`rounded-full border px-3 py-1 text-sm ${f.active ? "border-foreground bg-muted font-medium" : "text-muted-foreground hover:bg-muted"}`}
              >
                {f.label}
              </Link>
            ))}
          </nav>
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
