import { PageHeader } from "@/components/layout/page-header";
import { getGeoSnapshots, getProducts } from "@/lib/data";
import { GeoReport } from "@/app/(internal)/(dashboard)/market/_components/geo-report";

export default async function MarketGeoPage() {
  const [snapshots, ownProducts] = await Promise.all([getGeoSnapshots(), getProducts({ kind: "own" })]);

  return (
    <>
      <PageHeader title="AI 검색 노출 (GEO)" description="AI 검색 답변의 Share of Model · 인용 출처 · 결정 키워드 · 자사 Gap · 일본어 질의 5개 × 엔진 3개 (샘플)" featureId="GEO" />
      <GeoReport snapshots={snapshots} ownProducts={ownProducts} />
    </>
  );
}
