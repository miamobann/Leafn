import { ViewStateGate } from "@/components/common/view-state";
import { PageHeader } from "@/components/layout/page-header";
import { getProducts } from "@/lib/data";
import { CsvImport } from "./csv-import";
import { PlatformCollect } from "./platform-collect";

export default async function ReviewsImportPage() {
  const all = await getProducts();
  const products = all.map((p) => ({ id: p.id, name: p.name, brand: p.brand, kind: p.kind, platform: p.platform }));
  const projects = all
    .filter((p) => p.kind === "own")
    .map((p) => ({ id: p.id, brand: p.brand, name: p.name, category: p.category ?? "", volumeMl: p.volume_ml, priceJpy: p.price_jpy }));

  return (
    <>
      <PageHeader title="리뷰 가져오기" description="경쟁 제품 리뷰 CSV 업로드 또는 플랫폼 수집" featureId="E" />
      <ViewStateGate emptyAction="리뷰 CSV 올리기">
        <div className="space-y-4">
          <PlatformCollect projects={projects} />
          <CsvImport products={products} />
        </div>
      </ViewStateGate>
    </>
  );
}
