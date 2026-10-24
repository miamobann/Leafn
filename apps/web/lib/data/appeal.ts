// 소구점 찾기의 계산만 모은 곳 (DB도 샘플도 아닌 순수 함수).
// 공통 조회(index.ts)와 리뷰 화면(reviews.ts)이 DB·샘플 모두 같은 기준으로 계산한다.
// 경쟁 불만이 많고 + 자사 칭찬이 많고 + 자사 불만이 적은 주제가 소구점 후보다.
import { AppealTopic, type Review, type ReviewAnalysis } from "@/lib/schemas/review";

/** 소구점 후보 판정 기준 (팀 합의 전 시안). reviews/_lib/topics.ts의 강점 기준과 같은 숫자다 */
export const APPEAL_RULE = { minComplaints: 3, minPraises: 3, praiseToComplaintRatio: 2 } as const;

/** 경쟁 리뷰 중 이 별점 이하만 불만 후보로 본다 */
export const APPEAL_MAX_RATING = 3;

type AnalyzedReview = Review & { analysis: ReviewAnalysis | null };

function hasTopic(r: AnalyzedReview, topic: AppealTopic, polarity: "positive" | "negative") {
  return r.analysis?.topics?.some((t) => t.topic === topic && t.polarity === polarity) ?? false;
}

export function buildAppealComparison<O, C extends { id: string }, R extends AnalyzedReview>(input: {
  own: O;
  competitors: C[];
  /** 자사 국내 리뷰 (lang = ko) */
  ownReviews: R[];
  /** 경쟁 제품의 낮은 별점 리뷰 (lang = ja, rating <= maxRating) */
  lowReviews: R[];
  maxRating: number;
}) {
  const { own, competitors, ownReviews, lowReviews, maxRating } = input;

  const topics = AppealTopic.options
    .map((topic) => {
      const complaints = lowReviews.filter((r) => hasTopic(r, topic, "negative"));
      const praises = ownReviews.filter((r) => hasTopic(r, topic, "positive"));
      const ownComplaints = ownReviews.filter((r) => hasTopic(r, topic, "negative"));
      const complaintShare = lowReviews.length ? complaints.length / lowReviews.length : 0;
      const praiseShare = ownReviews.length ? praises.length / ownReviews.length : 0;
      return {
        topic,
        complaints,
        praises,
        ownComplaints,
        complaintShare,
        praiseShare,
        complaintProductCount: new Set(complaints.map((r) => r.product_id)).size,
        isCandidate:
          complaints.length >= APPEAL_RULE.minComplaints &&
          praises.length >= APPEAL_RULE.minPraises &&
          praises.length >= ownComplaints.length * APPEAL_RULE.praiseToComplaintRatio,
        score: complaintShare * praiseShare,
      };
    })
    .sort((a, b) => Number(b.isCandidate) - Number(a.isCandidate) || b.score - a.score);

  return {
    own,
    competitors: competitors.map((p) => ({ ...p, lowReviewCount: lowReviews.filter((r) => r.product_id === p.id).length })),
    ownReviewCount: ownReviews.length,
    lowReviewCount: lowReviews.length,
    /** AI 분석이 붙은 리뷰 수. 0이면 후보가 없는 게 아니라 아직 분석 전이다 */
    ownAnalyzedCount: ownReviews.filter((r) => r.analysis).length,
    lowAnalyzedCount: lowReviews.filter((r) => r.analysis).length,
    maxRating,
    rule: APPEAL_RULE,
    topics,
  };
}

/** 수집기는 rank, 샘플은 qoo10_rank를 사용한다. 알 수 없는 순위는 비교에서 제외한다. */
export function reviewProductRank(raw: Record<string, unknown> | null): number | null {
  const rank = raw?.rank ?? raw?.qoo10_rank;
  return typeof rank === "number" && Number.isInteger(rank) && rank > 0 ? rank : null;
}
