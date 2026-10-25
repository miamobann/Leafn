import { EmptyState } from "@/components/common/states";
import { PageHeader } from "@/components/layout/page-header";
import { DataTableTemplate } from "@/components/templates";
import { getAdChecks, getContentGuides, getMembers, getProducts } from "@/lib/data";
import { getMyWorkspace } from "@/lib/data/workspace";
import { formatDate } from "@/lib/format";
import { ActionBadge } from "../../_components/ad-badges";
import { DeleteButton } from "../../_components/delete-button";
import { HistoryFilters } from "../../_components/history-filters";
import { GUIDE_CHANNELS } from "../../_lib/content-guide-samples";

type GuideHistoryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const CHANNEL_LABEL = Object.fromEntries(GUIDE_CHANNELS.map((c) => [c.id, c.label]));

/** 만든 콘텐츠 목록 (content_guides). 검토 내역과 같은 표 모양. 삭제는 owner(팀장)만 */
export default async function GuideHistoryPage({ searchParams }: GuideHistoryPageProps) {
  const query = await searchParams;
  const productFilter = typeof query.product === "string" ? query.product : undefined;
  const channelFilter = typeof query.channel === "string" ? query.channel : undefined;
  const [all, checks, members, products, mine] = await Promise.all([
    getContentGuides(),
    getAdChecks({ source: "content_guide" }),
    getMembers(),
    getProducts(),
    getMyWorkspace().catch(() => null),
  ]);
  const isOwner = mine?.role === "owner";
  const guides = all.filter((g) => (!productFilter || g.product_id === productFilter) && (!channelFilter || g.channel === channelFilter));
  const memberName = (id: string | null) => members.find((m) => m.user_id === id)?.display_name ?? "—";
  const productName = (id: string | null) => products.find((p) => p.id === id)?.name ?? "—";
  const actionOf = (checkId: string | null) => checks.find((c) => c.id === checkId)?.overall_action ?? null;
  // 자사 제품은 모두 고를 수 있게 한다 (콘텐츠는 자사 제품으로만 만든다). 경쟁 제품은 뺀다
  const productOptions = products
    .filter((p) => p.kind === "own" || all.some((g) => g.product_id === p.id))
    .map((p) => ({ value: p.id, label: p.name }));

  return (
    <>
      <PageHeader title="만든 콘텐츠" description="콘텐츠 제작으로 만든 결과물과 콘텐츠 문구 자동 검사(약기법) 결과" featureId="A" />
      <div className="mb-4">
        <HistoryFilters
          filters={[
            { key: "product", label: "제품", options: productOptions },
            { key: "channel", label: "채널", options: GUIDE_CHANNELS.map((c) => ({ value: c.id, label: c.label })) },
          ]}
        />
      </div>
      {guides.length === 0 ? (
        <EmptyState message="조건에 맞는 콘텐츠가 없습니다" action="「콘텐츠 제작」에서 제목을 고르면 결과물이 자동으로 저장돼요" />
      ) : (
        <DataTableTemplate
          columns={[
            { key: "title", label: "제목" },
            { key: "product", label: "제품 · 채널" },
            { key: "action", label: "약기법" },
            { key: "author", label: "만든 사람" },
            { key: "date", label: "만든 날" },
            ...(isOwner ? [{ key: "delete", label: "" }] : []),
          ]}
          rows={guides.map((g) => {
            const action = actionOf(g.ad_check_id);
            return {
              id: g.id,
              href: `/ad-check/guide/history/${g.id}`,
              cells: {
                title: (
                  <span className="flex max-w-80 flex-col" title={g.title.title_ja}>
                    <span className="truncate font-medium underline-offset-4 [a:hover_&]:underline" lang="ja">
                      {g.title.title_ja}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{g.title.title_ko}</span>
                  </span>
                ),
                product: (
                  <span className="block max-w-44 truncate" title={productName(g.product_id)}>
                    {productName(g.product_id)} · {CHANNEL_LABEL[g.channel] ?? g.channel}
                  </span>
                ),
                action: action ? <ActionBadge action={action} /> : "—",
                author: memberName(g.created_by),
                date: formatDate(g.created_at),
                delete: <DeleteButton endpoint={`/api/content-guide/${g.id}`} confirmMessage="이 콘텐츠를 삭제할까요? 지운 결과물은 되돌릴 수 없습니다. (약기법 검사 기록은 남아요)" />,
              },
            };
          })}
        />
      )}
    </>
  );
}
