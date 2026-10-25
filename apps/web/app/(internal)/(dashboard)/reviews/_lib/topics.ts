// 리뷰 탭 화면들이 같이 쓰는 집계 (서버 · 브라우저 둘 다). 리뷰 분석 결과(analysis.topics)를 6개 주제로 센다.
// 판정 숫자는 소구점 찾기(lib/data getAppealComparison)의 기준과 맞춘다. 팀 합의 전 시안이다.
import type { ReviewWithAnalysis } from "@/lib/data/reviews";
import type { SkinLine } from "@/lib/schemas/project";
import { APPEAL_TOPICS, AppealTopic } from "@/lib/schemas/review";

export type Polarity = "positive" | "negative";
export type TopicStat = { topic: AppealTopic; pos: ReviewWithAnalysis[]; neg: ReviewWithAnalysis[] };
export type Verdict = "strength" | "weakness" | "unclear";

/** 칭찬이 이 건수 이상이고 같은 불만의 이 배수 이상이면 강점 (소구점 찾기 APPEAL_RULE과 같은 숫자) */
export const STRENGTH_RULE = { minPraises: 3, praiseToComplaintRatio: 2 } as const;

export const SKIN_LINE_LABEL: Record<SkinLine, string> = { dry: "건성 라인", oily: "지성 라인", combo: "복합성 라인" };
export const VERDICT_LABEL: Record<Verdict, string> = { strength: "강점", weakness: "약점", unclear: "근거 부족" };

export function hasTopic(r: ReviewWithAnalysis, topic: AppealTopic, polarity: Polarity) {
  return r.analysis?.topics?.some((t) => t.topic === topic && t.polarity === polarity) ?? false;
}

export function topicStats(reviews: ReviewWithAnalysis[]): TopicStat[] {
  return AppealTopic.options.map((topic) => ({
    topic,
    pos: reviews.filter((r) => hasTopic(r, topic, "positive")),
    neg: reviews.filter((r) => hasTopic(r, topic, "negative")),
  }));
}

export function verdictOf(s: TopicStat): Verdict {
  if (s.pos.length >= STRENGTH_RULE.minPraises && s.pos.length >= s.neg.length * STRENGTH_RULE.praiseToComplaintRatio) return "strength";
  if (s.neg.length > s.pos.length) return "weakness";
  return "unclear";
}

export function topicLabel(topic: AppealTopic, polarity: Polarity) {
  return APPEAL_TOPICS[topic][polarity].ko;
}

/** 칭찬 · 불만이 많은 순서 TOP3. 피부 반응(자극) 불만은 건수가 적어도 약점 목록에 넣는다 */
export function topThree(stats: TopicStat[], polarity: Polarity) {
  const key = polarity === "positive" ? "pos" : "neg";
  const ranked = stats.filter((s) => s[key].length > 0).toSorted((a, b) => b[key].length - a[key].length);
  const top = ranked.slice(0, 3);
  const irritation = ranked.find((s) => s.topic === "irritation");
  const pinned = polarity === "negative" && irritation && !top.includes(irritation);
  if (pinned) top.splice(2, 1, irritation);
  return top.map((s) => ({ ...s, count: s[key].length, pinned: Boolean(pinned && s === irritation) }));
}

export function share(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

export function average(values: number[]) {
  return values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;
}

/** 리뷰어 프로필 값(피부타입 · 연령대)의 분포. 적지 않은 리뷰는 뺀다 */
export function distribution(reviews: ReviewWithAnalysis[], pick: (r: ReviewWithAnalysis) => string | undefined) {
  const counts = new Map<string, number>();
  for (const r of reviews) {
    const v = pick(r);
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const known = [...counts.values()].reduce((a, b) => a + b, 0);
  return {
    known,
    items: [...counts].toSorted((a, b) => b[1] - a[1]).map(([label, n]) => ({ label, n, pct: share(n, known) })),
  };
}

export function ratingCounts(reviews: ReviewWithAnalysis[]) {
  return [5, 4, 3, 2, 1].map((star) => ({ star, n: reviews.filter((r) => Math.round(r.rating) === star).length }));
}

export function stars(rating: number) {
  const n = Math.max(0, Math.min(5, Math.round(rating)));
  return "★".repeat(n) + "☆".repeat(5 - n);
}

/** 기간 표시용 "2026-05 ~ 2026-10" */
export function periodOf(reviews: ReviewWithAnalysis[]) {
  if (reviews.length === 0) return null;
  const months = reviews.map((r) => r.posted_at.slice(0, 7)).toSorted();
  const [first, last] = [months[0], months[months.length - 1]];
  return first === last ? first : `${first} ~ ${last}`;
}

export function latestDate(reviews: ReviewWithAnalysis[]) {
  return reviews.map((r) => r.created_at.slice(0, 10)).toSorted().at(-1) ?? null;
}
