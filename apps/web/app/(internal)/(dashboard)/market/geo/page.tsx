import { PageHeader } from "@/components/layout/page-header";
import { getGeoSnapshots } from "@/lib/data";
import { GeoReport } from "@/app/(internal)/(dashboard)/market/_components/geo-report";

export default async function MarketGeoPage() {
  const snapshots = await getGeoSnapshots();

  return (
    <>
      <PageHeader title="AI 검색 노출 (GEO)" description="AI 검색 답변의 브랜드 언급 · 일본어 질의 5개 × 엔진 3개 (샘플)" featureId="GEO" />
      <GeoReport snapshots={snapshots} />
    </>
  );
}
