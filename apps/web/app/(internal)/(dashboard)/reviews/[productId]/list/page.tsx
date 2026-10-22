import { notFound } from "next/navigation";
import { Input } from "@/components/ui/input";
import { LangBadge, SentimentBadge } from "@/components/common/badges";
import { PageHeader } from "@/components/layout/page-header";
import { DataTableTemplate } from "@/components/templates";
import { getProduct, getProducts, getReviews } from "@/lib/data";
import { formatDate } from "@/lib/format";

export async function generateStaticParams() {
  return (await getProducts()).map((p) => ({ productId: p.id }));
}

export default async function ReviewListPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const product = await getProduct(productId);
  if (!product) notFound();
  const reviews = await getReviews({ productId });

  return (
    <>
      <PageHeader title={`리뷰 원문 · ${product.brand} ${product.name}`} featureId="E" />
      <DataTableTemplate
        filters={<Input placeholder="검색 (P4에서 연결)" className="w-64" disabled />}
        emptyAction="리뷰 CSV 올리기"
        columns={[
          { key: "body", label: "본문" },
          { key: "lang", label: "언어" },
          { key: "rating", label: "평점", align: "right" },
          { key: "sentiment", label: "감성" },
          { key: "attrs", label: "작성자" },
          { key: "date", label: "작성일" },
        ]}
        rows={reviews.map((r) => ({
          id: r.id,
          cells: {
            body: (
              <div className="max-w-md whitespace-normal">
                <p lang={r.lang}>{r.body}</p>
                {r.body_ko && <p className="text-muted-foreground">{r.body_ko}</p>}
              </div>
            ),
            lang: <LangBadge lang={r.lang} />,
            rating: `★ ${r.rating}`,
            sentiment: r.analysis ? <SentimentBadge sentiment={r.analysis.sentiment} /> : "—",
            attrs: [r.reviewer_attrs?.age_group, r.reviewer_attrs?.skin_type].filter(Boolean).join(" · "),
            date: formatDate(r.posted_at),
          },
        }))}
      />
    </>
  );
}
