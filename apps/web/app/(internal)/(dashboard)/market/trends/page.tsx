import { PageHeader } from "@/components/layout/page-header";
import { getProducts, getTrendSnapshots } from "@/lib/data";
import { TrendsReport } from "@/app/(internal)/(dashboard)/market/_components/trends-report";

export default async function MarketTrendsPage() {
  const [snapshots, products] = await Promise.all([getTrendSnapshots(), getProducts()]);

  return (
    <>
      <PageHeader title="시장 트렌드" description="楽天ランキング 기반 카테고리별 추이 · 化粧水·美容液·クリーム × 12주 (샘플)" featureId="B" />
      <TrendsReport snapshots={snapshots} products={products} />
    </>
  );
}
