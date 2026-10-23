import { PageHeader } from "@/components/layout/page-header";
import { getProducts } from "@/lib/data";
import { CompetitorsView } from "@/app/(internal)/(dashboard)/market/_components/competitors-view";

export default async function MarketCompetitorsPage() {
  const products = await getProducts();

  return (
    <>
      <PageHeader title="경쟁제품 비교" description="자사 vs 경쟁사 가격·용량·성분·특징 · 자사 3 + 경쟁 8 (샘플)" featureId="C" />
      <CompetitorsView products={products} />
    </>
  );
}
