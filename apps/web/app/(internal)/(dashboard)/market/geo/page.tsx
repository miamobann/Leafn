import { PageHeader } from "@/components/layout/page-header";
import { DataTableTemplate } from "@/components/templates";
import { getGeoSnapshots } from "@/lib/data";
import { formatDate } from "@/lib/format";

const OWN_BRAND = "Leafn";

export default async function MarketGeoPage() {
  const snapshots = await getGeoSnapshots();

  return (
    <>
      <PageHeader title="AI 검색 노출 (GEO)" description="AI 검색 답변의 브랜드 언급 (샘플)" featureId="GEO" />
      <DataTableTemplate
        columns={[
          { key: "query", label: "질의" },
          { key: "engine", label: "엔진" },
          { key: "own", label: "자사 언급" },
          { key: "brands", label: "언급 브랜드" },
          { key: "date", label: "측정일" },
        ]}
        rows={snapshots.map((g) => ({
          id: g.id,
          cells: {
            query: <span lang="ja">{g.query}</span>,
            engine: g.engine,
            own: g.brands_mentioned.includes(OWN_BRAND) ? "✓ 있음" : "✕ 없음",
            brands: g.brands_mentioned.join(", "),
            date: formatDate(g.captured_at),
          },
        }))}
      />
    </>
  );
}
