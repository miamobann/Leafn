import { PageHeader } from "@/components/layout/page-header";
import { DataTableTemplate } from "@/components/templates";
import { getProducts, getReviews } from "@/lib/data";

export default async function ReviewsPage() {
  const [products, reviews] = await Promise.all([getProducts(), getReviews()]);

  return (
    <>
      <PageHeader title="리뷰 리포트" description="제품별 감성·키워드·불만·재구매 요인" featureId="E" />
      <DataTableTemplate
        emptyAction="리뷰 CSV 올리기"
        columns={[
          { key: "name", label: "제품" },
          { key: "kind", label: "구분" },
          { key: "ko", label: "국내 리뷰", align: "right" },
          { key: "ja", label: "일본 리뷰", align: "right" },
        ]}
        rows={products.map((p) => {
          const mine = reviews.filter((r) => r.product_id === p.id);
          return {
            id: p.id,
            href: `/reviews/${p.id}`,
            cells: {
              name: `${p.brand} ${p.name}`,
              kind: p.kind === "own" ? "자사" : "경쟁",
              ko: mine.filter((r) => r.lang === "ko").length,
              ja: mine.filter((r) => r.lang === "ja").length,
            },
          };
        })}
      />
    </>
  );
}
