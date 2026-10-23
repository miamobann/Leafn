import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { DetailTemplate } from "@/components/templates";
import { getProduct, getProducts } from "@/lib/data";
import { formatJpy } from "@/lib/format";
import { platformLabel } from "@/lib/platforms";
import { pricePerMl } from "@/lib/schemas/product";

export async function generateStaticParams() {
  return (await getProducts()).map((p) => ({ productId: p.id }));
}

export default async function ProductDetailPage({ params }: { params: Promise<{ productId: string }> }) {
  const product = await getProduct((await params).productId);
  if (!product) notFound();

  return (
    <>
      <PageHeader title={`${product.brand} ${product.name}`} description="제품 상세" featureId="C" />
      <DetailTemplate
        badges={
          <>
            <Badge>{product.kind === "own" ? "자사" : "경쟁"}</Badge>
            <Badge variant="secondary">{platformLabel(product.platform)}</Badge>
          </>
        }
        attributes={[
          { label: "카테고리", value: product.category ?? "—" },
          { label: "가격(税込)", value: formatJpy(product.price_jpy) },
          { label: "용량", value: product.volume_ml ? `${product.volume_ml}ml` : "—" },
          { label: "ml당 가격", value: pricePerMl(product) != null ? `¥${pricePerMl(product)}` : "—" },
          { label: "특징", value: product.features.join(", ") },
        ]}
        sections={[{ title: "全成分", content: <p lang="ja">{product.ingredients.join("、")}</p> }]}
      />
    </>
  );
}
