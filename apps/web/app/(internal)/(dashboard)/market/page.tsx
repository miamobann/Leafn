import { PageHeader } from "@/components/layout/page-header";
import { getGeoSnapshots, getImportedSnsVideos, getProducts, getPromoEvents, getSearchSnapshots, getSnsPatterns, getSnsVideoNotes, getTrendSnapshots } from "@/lib/data";
import { MarketOverview } from "@/app/(internal)/(dashboard)/market/_components/overview/market-overview";

// 시장 분석(TAB 1) 원페이지 개요. 위에서 아래로 요약 → 시장 개관 → 플랫폼 분석 → 소비자 트렌드 순서로 읽는다
export default async function MarketPage() {
  const [rakuten, qoo10, products, promoEvents, search, snsNotes, snsPatterns, geo, snsImported] = await Promise.all([
    getTrendSnapshots({ source: "rakuten_ranking" }),
    getTrendSnapshots({ source: "qoo10_ranking" }),
    getProducts(),
    getPromoEvents(),
    getSearchSnapshots(),
    getSnsVideoNotes(),
    getSnsPatterns(),
    getGeoSnapshots(),
    getImportedSnsVideos(),
  ]);

  return (
    <>
      <PageHeader title="시장 분석" description="저장된 시장 데이터 · 카테고리·플랫폼별 조회" />
      <MarketOverview
        snapshots={[...rakuten, ...qoo10]}
        products={products}
        promoEvents={promoEvents}
        search={search}
        snsNotes={snsNotes}
        snsPatterns={snsPatterns}
        geo={geo}
        snsImported={snsImported}
      />
    </>
  );
}
