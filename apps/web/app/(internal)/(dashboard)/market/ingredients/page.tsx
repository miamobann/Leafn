import { PageHeader } from "@/components/layout/page-header";
import { getProducts, getTrendSnapshots } from "@/lib/data";
import { IngredientsReport } from "@/app/(internal)/(dashboard)/market/_components/ingredients-report";

export default async function MarketIngredientsPage() {
  const [snapshots, products] = await Promise.all([getTrendSnapshots(), getProducts()]);

  return (
    <>
      <PageHeader title="성분 관심도" description="랭킹 상품명·설명에 자주 등장하는 성분 · 성분 10개 × 12주 (샘플)" featureId="B" />
      <IngredientsReport snapshots={snapshots} products={products} />
    </>
  );
}
