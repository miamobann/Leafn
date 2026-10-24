import { notFound } from "next/navigation";
import { getAdCheck, getReviewTranslations } from "@/lib/data";
import { getReviewProductById, getReviewsOf } from "@/lib/data/reviews";
import { TranslateView, type TranslatedRow } from "./translate-view";

export default async function ReviewTranslatePage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ pick?: string }>;
}) {
  const { productId } = await params;
  const { pick } = await searchParams;
  const product = await getReviewProductById(productId);
  if (!product) notFound();
  const [reviews, translations] = await Promise.all([getReviewsOf(productId, { lang: "ko" }), getReviewTranslations(productId)]);

  // 상태: 담당자 승인 → 승인 · 약기법 검토에서 고칠 표현이 나옴(높은 위험 또는 반려) → 고쳐야 함 · 그 밖 → 검토 대기
  const rows: TranslatedRow[] = await Promise.all(
    translations.map(async (t) => {
      const check = t.ad_check_id ? await getAdCheck(t.ad_check_id) : null;
      const risky = check?.findings.find((f) => f.risk === "high" || f.action === "must_fix");
      const status = t.status === "approved" ? "approved" : check?.review_status === "rejected" || risky ? "fix" : "pending";
      return {
        id: t.id,
        reviewId: t.review_id,
        textJa: t.text_ja,
        textKo: reviews.find((r) => r.id === t.review_id)?.body ?? "",
        status,
        note: risky ? `「${risky.text}」 ${risky.reason}` : status === "pending" ? "약기법 검토: 위험 표현 없음 · 담당자 승인 전" : "",
        checkId: check?.id ?? null,
      };
    }),
  );
  const ids = new Set(reviews.map((r) => r.id));
  const initialPicked = (pick ?? "").split(",").filter((id) => ids.has(id));

  return <TranslateView product={product} reviews={reviews} translated={rows} initialPicked={initialPicked} />;
}
