import { PageHeader } from "@/components/layout/page-header";
import { getGeoSnapshots, getProducts, getTrendSnapshots } from "@/lib/data";
import { GeoInsights } from "@/app/(internal)/(dashboard)/market/_components/geo-insights";
import { TrendsReport } from "@/app/(internal)/(dashboard)/market/_components/trends-report";

export default async function MarketTrendsPage() {
  const [snapshots, products, geo] = await Promise.all([getTrendSnapshots({ source: "rakuten_ranking" }), getProducts(), getGeoSnapshots()]);

  return (
    <>
      <PageHeader title="시장 트렌드" description="楽天ランキング 기반 카테고리별 추이 · 化粧水·美容液·クリーム × 12주 (샘플)" featureId="B" />
      <TrendsReport snapshots={snapshots} products={products} />
      <section className="mt-8 space-y-3">
        <div>
          <h2 className="text-lg font-semibold">AI 검색 핵심 포인트 (GEO)</h2>
          <p className="text-sm text-muted-foreground">
            AI 검색 답변은 매번 달라서, 여러 답변을 모았을 때 반복해서 나오는 추천 사유·인용 출처·자사 Gap만 봐요 · 질의는 카테고리 × 피부 고민, 질의마다 3회
          </p>
        </div>
        <GeoInsights initial={geo} ownProducts={products.filter((p) => p.kind === "own")} />
      </section>
    </>
  );
}
