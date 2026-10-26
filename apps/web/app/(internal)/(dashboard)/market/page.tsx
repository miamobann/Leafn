import { getGeoSnapshots, getProducts, getPromoEvents, getSearchSnapshots, getSnsAnalyses, getTrendSnapshots } from "@/lib/data";
import { loadSubmissionPanel, type SubmissionPanelData } from "@/components/common/submission-section";
import { MarketOverview } from "@/app/(internal)/(dashboard)/market/_components/overview/market-overview";

// 시장 분석(TAB 1). 탭: 요약 → 우리 제품 대응 → 플랫폼 분석 → 소비자 트렌드 → 경쟁제품
export default async function MarketPage() {
  const [rakuten, qoo10, products, promoEvents, search, geo, sns] = await Promise.all([
    getTrendSnapshots({ source: "rakuten_ranking" }),
    getTrendSnapshots({ source: "qoo10_ranking" }),
    getProducts(),
    getPromoEvents(),
    getSearchSnapshots(),
    getGeoSnapshots(),
    getSnsAnalyses(),
  ]);
  // 요약 맨 아래 「시안 · 결재 (시장 분석)」: 판매 중인 자사 제품마다 시안 · 버전 히스토리를 미리 읽어 둔다 (화면에서 자사 제품을 고르면 그 제품 것을 보여 준다)
  const panelEntries = await Promise.all(products.filter((p) => p.kind === "own").map(async (p) => [p.id, await loadSubmissionPanel("market", p)] as const));
  const submissionPanels = Object.fromEntries(panelEntries.filter((e): e is readonly [string, SubmissionPanelData] => e[1] !== null));

  return (
    <>
      {/* 제목·설명·[데이터 업데이트]는 MarketOverview가 그린다 (고른 카테고리를 알아야 해서) */}
      <MarketOverview
        snapshots={[...rakuten, ...qoo10]}
        products={products}
        promoEvents={promoEvents}
        search={search}
        geo={geo}
        sns={sns}
        submissionPanels={submissionPanels}
      />
    </>
  );
}
