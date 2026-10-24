import { PageHeader } from "@/components/layout/page-header";
import { getProducts } from "@/lib/data";
import { CompetitorsView } from "@/app/(internal)/(dashboard)/market/_components/competitors-view";

// ?compare=id1,id2 로 들어오면 그 제품들을 처음부터 골라 둔다 (시장 분석 원페이지의 [선택 제품 비교])
export default async function MarketCompetitorsPage({ searchParams }: { searchParams: Promise<{ compare?: string }> }) {
  const [products, { compare }] = await Promise.all([getProducts(), searchParams]);
  const ids = new Set(products.map((p) => p.id));
  const initialSelected = (compare ?? "").split(",").filter((id) => ids.has(id));

  return (
    <>
      <PageHeader title="경쟁제품 비교" description="자사 vs 경쟁사 가격·용량·성분·특징 · 자사 3 + 경쟁 8 (샘플)" featureId="C" />
      <CompetitorsView products={products} initialSelected={initialSelected} />
    </>
  );
}
