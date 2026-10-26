import { EmptyState } from "@/components/common/states";
import { PageHeader } from "@/components/layout/page-header";
import { DataTableTemplate } from "@/components/templates";
import { getAdChecks, getContentGuide, getContentGuides, getMembers, getProducts } from "@/lib/data";
import type { AdAction } from "@/lib/schemas/ad-check";
import { getAdProducts } from "@/lib/data/ad-products";
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

/** 가장 무거운 판정 (고쳐야 함 > 전문가 확인 > 수정 권장 > 문제 없음). 판정이 없으면 null */
const ACTION_WEIGHT: Record<AdAction, number> = { must_fix: 3, expert: 2, should_fix: 1, ok: 0 };
function worstAction(actions: AdAction[]): AdAction | null {
  return actions.reduce<AdAction | null>((worst, a) => (worst === null || ACTION_WEIGHT[a] > ACTION_WEIGHT[worst] ? a : worst), null);
}

/** 만든 가이드 목록 (content_guides). 검토 내역과 같은 표 모양. 삭제는 owner(팀장)만 */
export default async function GuideHistoryPage({ searchParams }: GuideHistoryPageProps) {
  const query = await searchParams;
  const productFilter = typeof query.product === "string" ? query.product : undefined;
  const channelFilter = typeof query.channel === "string" ? query.channel : undefined;
  const [all, checks, members, products, mine, adProducts] = await Promise.all([
    getContentGuides(),
    getAdChecks({ source: "content_guide" }),
    getMembers(),
    getProducts(),
    getMyWorkspace().catch(() => null),
    getAdProducts(),
  ]);
  const isOwner = mine?.role === "owner";
  // 수정 전 버전은 숨긴다: 수정본(parent_id 로 이어진 다음 버전)이 있는 가이드는 목록에서 빼고 최신 수정본만 보여 준다.
  // 지우지 않으므로 수정본 화면의 「이전 버전 보기」로 열 수 있다 (약기법에 걸린 문구와 검사 기록은 증거로 남는다)
  const superseded = new Set(all.flatMap((g) => (g.parent_id ? [g.parent_id] : [])));
  const guides = all.filter((g) => !superseded.has(g.id) && (!productFilter || g.product_id === productFilter) && (!channelFilter || g.channel === channelFilter));
  const memberName = (id: string | null) => members.find((m) => m.user_id === id)?.display_name ?? "—";
  const productName = (id: string | null) => products.find((p) => p.id === id)?.name ?? "—";
  // 수정본(약기법 수정)의 판정: 고친 줄은 통과로 보고 남은 줄 중 가장 무거운 판정 (getContentGuide 가 블록별로 계산)
  const revisedAction = new Map(
    await Promise.all(
      guides
        .filter((g) => g.parent_id)
        .map(async (g) => [g.id, worstAction((await getContentGuide(g.id))?.checks.map((c) => c.action) ?? [])] as const),
    ),
  );
  const actionOf = (g: (typeof all)[number]) => (g.parent_id ? (revisedAction.get(g.id) ?? null) : (checks.find((c) => c.id === g.ad_check_id)?.overall_action ?? null));
  // 콘텐츠를 만들 수 있는 제품(전성분·가격·용량이 등록된 자사 제품)과 이미 만든 콘텐츠의 제품만 고를 수 있게 한다
  const usable = new Set(adProducts.filter((p) => p.price_jpy > 0 && p.volume !== "미등록" && p.line !== "미등록").map((p) => p.id));
  const productOptions = products
    .filter((p) => usable.has(p.id) || all.some((g) => g.product_id === p.id))
    .map((p) => ({ value: p.id, label: p.name }));

  return (
    <>
      <PageHeader title="만든 가이드" description="콘텐츠 제작 가이드로 만든 결과물과 약기법 자동 검사 결과" featureId="A" />
      <div className="mb-4">
        <HistoryFilters
          filters={[
            { key: "product", label: "제품", options: productOptions },
            { key: "channel", label: "채널", options: GUIDE_CHANNELS.map((c) => ({ value: c.id, label: c.label })) },
          ]}
        />
      </div>
      {guides.length === 0 ? (
        <EmptyState message="조건에 맞는 가이드가 없습니다" action="「콘텐츠 제작 가이드」에서 제목을 고르면 결과물이 자동으로 저장돼요" />
      ) : (
        <DataTableTemplate
          columns={[
            { key: "title", label: "제목" },
            { key: "product", label: "제품" },
            { key: "channel", label: "채널" },
            { key: "action", label: "약기법" },
            { key: "author", label: "작성자" },
            { key: "date", label: "만든 날" },
            ...(isOwner ? [{ key: "delete", label: "" }] : []),
          ]}
          rows={guides.map((g) => {
            const action = actionOf(g);
            return {
              id: g.id,
              href: `/ad-check/guide/history/${g.id}`,
              cells: {
                title: (
                  // 목록 제목은 한국어로 통일 (검토 이력과 같다). 마우스를 올리면 일본어 제목
                  <span className="block max-w-80 truncate font-medium underline-offset-4 [a:hover_&]:underline" title={g.title.title_ja}>
                    {g.parent_id && (
                      <span className="mr-1 rounded border px-1 text-xs font-normal" title="새 검토에서 대체 표현으로 고친 버전이에요. 고치기 전 버전은 목록에서 숨겨져 있어요">
                        약기법 수정
                      </span>
                    )}
                    {g.title.title_ko}
                  </span>
                ),
                product: (
                  <span className="block max-w-44 truncate" title={productName(g.product_id)}>
                    {productName(g.product_id)}
                  </span>
                ),
                channel: <span className="whitespace-nowrap">{CHANNEL_LABEL[g.channel] ?? g.channel}</span>,
                action: action ? <ActionBadge action={action} /> : "—",
                author: memberName(g.created_by),
                date: formatDate(g.created_at),
                delete: <DeleteButton endpoint={`/api/content-guide/${g.id}`} confirmMessage="이 가이드를 삭제할까요? 지운 결과물은 되돌릴 수 없습니다. (약기법 검사 기록은 남아요)" />,
              },
            };
          })}
        />
      )}
    </>
  );
}
