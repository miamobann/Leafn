// 콘텐츠 제작 가이드가 리뷰 인용으로 쓸 수 있는 번역: 팀장이 승인한 리뷰 분석 시안에 담긴 일본어 후기 (읽기 전용).
// 승인은 문구마다 하지 않고 시안(버전) 단위로 한다 — 요약 탭에서 담은 후기와 소구점을 팀장이 한 번에 결재한다 (2026-10-26).
// 약기법 검토를 통과한 번역만 시안에 담기므로, 승인된 시안의 후기는 그대로 인용할 수 있다.
import { getSubmissions, getSubmissionVersions } from "@/lib/data/submissions";
import { ReviewBody } from "@/lib/schemas/submission";

export type ApprovedReviewQuote = {
  reviewId: string;
  reviewTranslationId: string;
  /** 승인된 일본어 번역 */
  textJa: string;
  /** 번역한 한국어 문장 (대체 표현으로 고쳤다면 고친 문장) */
  textKo: string;
};

/** 이 자사 제품의 승인된 리뷰 분석 시안(가장 최근 승인본)에 담긴 후기. 승인된 시안이 없거나 담은 후기가 없으면 빈 배열 */
export async function getApprovedReviewQuotes(productId: string): Promise<ApprovedReviewQuote[]> {
  const [submission] = await getSubmissions({ productId, tab: "review" });
  if (!submission) return [];
  const approved = (await getSubmissionVersions(submission.id)).find((v) => v.status === "approved");
  const body = approved ? ReviewBody.safeParse(approved.body) : null;
  if (!body?.success) return [];
  return (body.data.translations ?? []).map((t) => ({
    reviewId: t.review_id,
    reviewTranslationId: t.review_translation_id,
    textJa: t.text_ja,
    textKo: t.text_ko,
  }));
}
