import { PageHeader } from "@/components/layout/page-header";
import { getProducts, getSearchSnapshots, getTrendSnapshots } from "@/lib/data";
import { AppealReport } from "@/app/(internal)/(dashboard)/market/_components/appeal-report";
import { IngredientsReport } from "@/app/(internal)/(dashboard)/market/_components/ingredients-report";

export default async function MarketIngredientsPage() {
  const [snapshots, qoo10, search, products] = await Promise.all([
    getTrendSnapshots({ source: "rakuten_ranking" }),
    getTrendSnapshots({ source: "qoo10_ranking", category: "化粧水" }),
    getSearchSnapshots(),
    getProducts(),
  ]);

  return (
    <>
      <PageHeader title="성분 관심도" description="현재 트렌드(楽天·Qoo10 상위 상품 이미지의 소구 성분) · 미래 트렌드(Google 자동완성) · 상품명·설명의 성분 언급 빈도 (샘플)" featureId="B" />
      <AppealReport
        initial={{ rakuten_ranking: snapshots.filter((s) => s.category === "化粧水").at(-1), qoo10_ranking: qoo10.at(-1) }}
        searchInitial={search}
        products={products}
      />
      <div className="mt-6">
        <IngredientsReport snapshots={snapshots} products={products} />
      </div>
    </>
  );
}
