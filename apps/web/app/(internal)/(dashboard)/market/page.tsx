import { PageHeader } from "@/components/layout/page-header";
import { getClaimJudgments, getCopyCandidates, getGeoSnapshots, getProducts, getPromoEvents, getSearchSnapshots, getSnsPatterns, getSnsVideoNotes, getTrendSnapshots } from "@/lib/data";
import { MarketOverview } from "@/app/(internal)/(dashboard)/market/_components/overview/market-overview";

// 시장 분석(TAB 1) 원페이지 개요. 위에서 아래로 시장 개관 → 공급 → 수요 → 기회와 전략 순서로 읽는다
export default async function MarketPage() {
  const [rakuten, qoo10, products, promoEvents, search, snsNotes, snsPatterns, geo, judgments, copies] = await Promise.all([
    getTrendSnapshots({ source: "rakuten_ranking" }),
    getTrendSnapshots({ source: "qoo10_ranking" }),
    getProducts(),
    getPromoEvents(),
    getSearchSnapshots(),
    getSnsVideoNotes(),
    getSnsPatterns(),
    getGeoSnapshots(),
    getClaimJudgments(),
    getCopyCandidates(),
  ]);

  return (
    <>
      <PageHeader title="시장 분석" description="카테고리·플랫폼을 고르면 아래 모든 섹션이 함께 바뀌어요 (샘플)" />
      <MarketOverview
        snapshots={[...rakuten, ...qoo10]}
        products={products}
        promoEvents={promoEvents}
        search={search}
        snsNotes={snsNotes}
        snsPatterns={snsPatterns}
        geo={geo}
        judgments={judgments}
        copies={copies}
      />
    </>
  );
}
