import { PageHeader } from "@/components/layout/page-header";
import { BarList, ReportTemplate } from "@/components/templates";
import { getIngredientInterest, getProducts } from "@/lib/data";

const CATEGORY = "化粧水";

export default async function MarketIngredientsPage() {
  const [ingredients, own] = await Promise.all([getIngredientInterest({ category: CATEGORY }), getProducts({ kind: "own" })]);
  const ownIngredients = new Set(own.flatMap((p) => p.ingredients));

  return (
    <>
      <PageHeader title="성분 관심도" description="랭킹 상품명·설명에 자주 등장하는 성분 (샘플)" featureId="B" />
      <ReportTemplate
        cards={[
          {
            title: `성분 빈도 · ${CATEGORY}`,
            wide: true,
            content: (
              <BarList
                items={ingredients.map((i) => ({
                  label: ownIngredients.has(i.ingredient) ? `★ ${i.ingredient}` : i.ingredient,
                  value: i.count,
                }))}
              />
            ),
          },
        ]}
      />
      <p className="mt-2 text-xs text-muted-foreground">★ 자사 제품에 든 성분 · 성분을 누르면 상품 목록 패널은 P3에서 연결</p>
    </>
  );
}
