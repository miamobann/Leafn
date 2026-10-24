import { notFound } from "next/navigation";
import { AiDisclaimer } from "@/components/common/ai";
import { StatusBadge } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { TextReviewTemplate } from "@/components/templates";
import { getAdCheck, getReviewTranslations } from "@/lib/data";
import { getReviewProductById, getReviewsOf } from "@/lib/data/reviews";

export default async function ReviewTranslatePage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const product = await getReviewProductById(productId);
  if (!product) notFound();
  const [reviews, translations] = await Promise.all([getReviewsOf(productId, { lang: "ko" }), getReviewTranslations(productId)]);
  const checks = await Promise.all(translations.map((t) => (t.ad_check_id ? getAdCheck(t.ad_check_id) : null)));

  return (
    <>
      <PageHeader title={`상세페이지용 리뷰 번역 · ${product.brand} ${product.name}`} featureId="F" />
      <AiDisclaimer />
      <div className="mt-4">
        <TextReviewTemplate
          input={
            <ul className="space-y-2 text-sm">
              {reviews.map((r) => (
                <li key={r.id} className="rounded-md border p-2">
                  {r.body}
                </li>
              ))}
            </ul>
          }
          result={
            <ul className="space-y-3 text-sm">
              {translations.map((t, i) => (
                <li key={t.id} className="rounded-md border p-2">
                  <p lang="ja">{t.text_ja}</p>
                  <div className="mt-2 flex items-center gap-2">
                    {checks[i] && <StatusBadge status={checks[i].review_status} />}
                    <Button size="sm" variant="outline" disabled title="승인 전에는 복사할 수 없어요">
                      HTML 복사
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          }
        />
      </div>
    </>
  );
}
