import { ViewStateGate } from "@/components/common/view-state";
import { PageHeader } from "@/components/layout/page-header";
import { getProducts } from "@/lib/data";
import { getCollectionOwnProducts } from "@/lib/data/collection";
import { CsvImport } from "./csv-import";
import { PlatformCollect } from "./collect-panel";

export default async function ReviewsImportPage() {
  const all = await getProducts();
  const products = all.map((p) => ({ id: p.id, name: p.name, brand: p.brand, kind: p.kind, platform: p.platform }));
  // 플랫폼 수집은 DB의 우리 제품을 쓴다 (수집 요청이 DB의 제품 id를 가리킨다). CSV 업로드는 아직 샘플 제품 목록을 쓴다
  const projects = await getCollectionOwnProducts();

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
