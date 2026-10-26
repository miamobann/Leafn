import { getGeoSnapshots, getProducts, getPromoEvents, getSearchSnapshots, getSnsAnalyses, getTrendSnapshots } from "@/lib/data";
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
      />
    </>
  );
}
