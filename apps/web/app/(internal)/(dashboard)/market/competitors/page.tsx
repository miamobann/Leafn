import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { DataTableTemplate } from "@/components/templates";
import { getProducts } from "@/lib/data";
import { formatJpy } from "@/lib/format";
import { pricePerMl } from "@/lib/schemas/product";

export default async function MarketCompetitorsPage() {
  // 자사 행을 맨 위에 고정
  const products = (await getProducts()).toSorted((a, b) => (a.kind === b.kind ? 0 : a.kind === "own" ? -1 : 1));

  return (
    <>
      <PageHeader title="경쟁제품 비교" description="자사 vs 경쟁사 가격·용량·성분·특징" featureId="C" />
      <DataTableTemplate
        filters={<Button disabled>경쟁제품 등록 (P3에서 연결)</Button>}
        columns={[
          { key: "name", label: "제품" },
          { key: "platform", label: "플랫폼" },
          { key: "price", label: "가격(税込)", align: "right" },
          { key: "volume", label: "용량", align: "right" },
          { key: "perMl", label: "ml당", align: "right" },
          { key: "features", label: "특징" },
        ]}
        rows={products.map((p) => ({
          id: p.id,
          href: `/market/competitors/${p.id}`,
          cells: {
            name: (
              <span className="inline-flex items-center gap-2">
                {p.kind === "own" && <Badge>자사</Badge>}
                {p.brand} {p.name}
              </span>
            ),
            platform: p.platform,
            price: formatJpy(p.price_jpy),
            volume: p.volume_ml ? `${p.volume_ml}ml` : "—",
            perMl: pricePerMl(p) != null ? `¥${pricePerMl(p)}` : "—",
            features: p.features.join(", "),
          },
        }))}
      />
    </>
  );
}
