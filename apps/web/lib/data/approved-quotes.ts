// 콘텐츠 제작 가이드가 리뷰 인용으로 쓸 수 있는 번역: 약기법 검토를 거치고 팀장이 승인한 일본어 리뷰 (읽기 전용).
// 승인은 두 곳에서 일어난다 — 상세페이지용 리뷰 화면(review_translations.status)과 광고 검토 화면(ad_checks.review_status) — 그래서 둘 중 하나만 승인이어도 승인으로 본다.
import { getAdChecks, getReviewTranslations } from "@/lib/data";
import { getReviewsOf } from "@/lib/data/reviews";

export type ApprovedReviewQuote = {
  reviewId: string;
  reviewTranslationId: string;
  /** 승인된 일본어 번역 */
  textJa: string;
  /** 번역한 한국어 문장 (대체 표현으로 고쳤다면 고친 문장) */
  textKo: string;
};

/** 이 자사 제품의 승인된 번역을 최신순으로. 승인된 것이 없으면 빈 배열 */
export async function getApprovedReviewQuotes(productId: string): Promise<ApprovedReviewQuote[]> {
  const [translations, checks, reviews] = await Promise.all([getReviewTranslations(productId), getAdChecks(), getReviewsOf(productId, { lang: "ko" })]);
  const checkById = new Map(checks.map((c) => [c.id, c]));
  const bodyById = new Map(reviews.map((r) => [r.id, r.body]));
  return translations
    .filter((t) => t.status === "approved" || (t.ad_check_id !== null && checkById.get(t.ad_check_id)?.review_status === "approved"))
    .map((t) => ({
      reviewId: t.review_id,
      reviewTranslationId: t.id,
      textJa: t.text_ja,
      textKo: (t.ad_check_id ? checkById.get(t.ad_check_id)?.input_text : undefined) ?? bodyById.get(t.review_id) ?? "",
    }));
}
