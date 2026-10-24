import { PageHeader } from "@/components/layout/page-header";
import { DataTableTemplate } from "@/components/templates";
import { getReviewProductList } from "@/lib/data/reviews";

export default async function ReviewsPage() {
  const products = await getReviewProductList();

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
        rows={products.map((p) => ({
          id: p.id,
          href: `/reviews/${p.id}`,
          cells: {
            name: `${p.brand} ${p.name}`,
            kind: p.kind === "own" ? "자사" : "경쟁",
            ko: p.ko,
            ja: p.ja,
          },
        }))}
      />
    </>
  );
}
