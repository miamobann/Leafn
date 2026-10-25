import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getGeoSnapshots, getProduct, getProducts, getTrendSnapshots } from "@/lib/data";
import { ProductDetailView } from "@/app/(internal)/(dashboard)/market/_components/product-detail-view";
import { COMMON_INGREDIENTS, rankHistory } from "@/app/(internal)/(dashboard)/market/_lib/market";



export default async function ProductDetailPage({ params }: { params: Promise<{ productId: string }> }) {
  const product = await getProduct((await params).productId);
  if (!product) notFound();

  const [own, snapshots, geo] = await Promise.all([getProducts({ kind: "own" }), getTrendSnapshots({ source: "rakuten_ranking" }), getGeoSnapshots()]);
  const ownIngredients = new Set(own.filter((p) => p.id !== product.id).flatMap((p) => p.ingredients));
  const sharedWithOwn = product.ingredients.filter((x) => ownIngredients.has(x) && !COMMON_INGREDIENTS.has(x));

  return (
    <>
      <PageHeader title={`${product.brand} ${product.name}`} description="제품 상세 · 全成分 · 특징 · 출처 · 추출 원본" featureId="C" />
      <ProductDetailView
        product={product}
        sharedWithOwn={sharedWithOwn}
        rank={rankHistory(snapshots, product)}
        geoMentions={geo.filter((g) => g.brands_mentioned.includes(product.brand)).length}
        geoTotal={geo.length}
      />
    </>
  );
}
