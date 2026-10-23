import { APPEAL_TOPICS, AppealTopic, ReviewAnalysis, type TopicTag } from "@/lib/schemas/review";
import { parseAll, ts } from "./helpers";
import { reviews, reviewTopicSeeds } from "./reviews";

/** "+texture -scent" → 주제 태그. 리뷰마다 태그 문자열이 있어야 한다 */
function parseTags(reviewId: string): TopicTag[] {
  const seed = reviewTopicSeeds[reviewId];
  if (seed === undefined) throw new Error(`가짜 데이터 검증 실패: ${reviewId}의 주제 태그가 없어요`);
  return seed
    .split(" ")
    .filter(Boolean)
    .map((tag) => ({
      topic: AppealTopic.parse(tag.slice(1)),
      polarity: tag.startsWith("+") ? "positive" : "negative",
    }));
}

// AI 분석 결과를 흉내 낸다: 감성은 평점에서, 키워드·불만·재구매 요인은 주제 태그에서 만든다
export const reviewAnalyses = parseAll(
  ReviewAnalysis,
  reviews.map((r) => {
    const topics = parseTags(r.id);
    const label = (t: TopicTag) => APPEAL_TOPICS[t.topic][t.polarity][r.lang];
    return {
      id: `ra-${r.id}`,
      created_at: ts("2026-10-20"),
      review_id: r.id,
      sentiment: r.rating >= 4 ? "positive" : r.rating <= 2 ? "negative" : "neutral",
      keywords: topics.map((t) => ({ text: label(t), category: APPEAL_TOPICS[t.topic].category })),
      pain_points: topics.filter((t) => t.polarity === "negative").map(label),
      repurchase_factors: topics.filter((t) => t.polarity === "positive").map(label),
      topics,
      model: "claude-haiku-5-5",
      prompt_version: "review-analysis.v1",
    };
  }),
  "reviewAnalyses",
);
