// 시안 버전에 저장할 탭별 결과 스냅샷 (docs/team-approval-ai-analysis.md 5장 body · evidence · data_as_of).
// 화면이 보낸 내용을 믿지 않고 저장하는 순간의 데이터로 서버에서 다시 만든다. 근거 ID는 실제로 읽은 행만 넣는다 (DB_RULES 4.2).
import { topicStats, verdictOf } from "@/app/(internal)/(dashboard)/reviews/_lib/topics";
import { translationNeedsFix } from "@/lib/review-translation-state";
import type { AppealTopic } from "@/lib/schemas/review";
import { AdBody, type EvidenceRef, ReviewBody } from "@/lib/schemas/submission";
import { getAdChecks, getAppealComparison, getReviewTranslations } from "./index";
import { getReviewsOf } from "./reviews";
import { summarizeReviews } from "./row-adapters";

/** 항목 하나에 남기는 근거 리뷰 수와 불만 · 재구매 요인 · 키워드 항목 수 (body가 너무 커지지 않게) */
const MAX_EVIDENCE_PER_ITEM = 20;
const MAX_ITEMS = 5;
const EXCERPT_CHARS = 80;

export type VersionSnapshot<B> = { body: B; evidence: EvidenceRef[]; data_as_of: string | null };

/** 가장 늦은 시각. 시간대 표기가 섞여 있어도 맞게 비교하려고 Date로 바꿔 비교한다 */
function latestOf(values: (string | null | undefined)[]): string | null {
  const times = values.flatMap((v) => (v ? [new Date(v).getTime()] : [])).filter((t) => !Number.isNaN(t));
  return times.length ? new Date(Math.max(...times)).toISOString() : null;
}

/** 리뷰 리포트 화면과 같은 데이터: 자사 제품의 국내(ko) 리뷰와 그 분석 결과 (reviews/[productId]/page.tsx) */
export async function buildReviewSnapshot(productId: string): Promise<VersionSnapshot<ReviewBody>> {
  const reviews = (await getReviewsOf(productId)).filter((r) => r.lang === "ko");
  const { sentiment, insights } = summarizeReviews(reviews);
  const ids = (rows: { id: string }[]) => rows.slice(0, MAX_EVIDENCE_PER_ITEM).map((r) => r.id);
  const items = (kind: "pain_point" | "repurchase_factor" | "keyword") =>
    insights
      .filter((i) => i.kind === kind)
      .slice(0, MAX_ITEMS)
      .map((i) => ({ label: i.label, count: i.count, evidence_review_ids: i.evidence_review_ids.slice(0, MAX_EVIDENCE_PER_ITEM) }));

  const body = ReviewBody.parse({
    product_id: productId,
    review_count: reviews.length,
    analyzed_count: reviews.filter((r) => r.analysis).length,
    sentiment,
    topics: topicStats(reviews).map((s) => ({
      topic: s.topic,
      positive: s.pos.length,
      negative: s.neg.length,
      verdict: verdictOf(s),
      evidence_review_ids: ids([...s.pos, ...s.neg]),
    })),
    pain_points: items("pain_point"),
    repurchase_factors: items("repurchase_factor"),
    keywords: items("keyword"),
  });
  const cited = new Set(
    [...body.topics, ...body.pain_points, ...body.repurchase_factors, ...body.keywords].flatMap((i) => i.evidence_review_ids),
  );
  return {
    body,
    evidence: [...cited].map((id) => ({ kind: "review", id })),
    data_as_of: latestOf(reviews.map((r) => r.posted_at)),
  };
}

/** 광고 검토 시안에는 같은 제품의 숨기지 않은 검토 건만 담는다. 일부라도 맞지 않으면 저장하지 않는다 */
export async function buildAdSnapshot(productId: string, adCheckIds: string[]): Promise<VersionSnapshot<AdBody>> {
  const wanted = new Set(adCheckIds);
  if (wanted.size === 0) throw new Error("시안에 담을 광고 검토 건을 골라 주세요");
  const checks = (await getAdChecks({ source: "all" })).filter((c) => wanted.has(c.id));
  if (checks.length !== wanted.size || checks.some((c) => c.product_id !== productId)) {
    throw new Error("이 제품에 속한 광고 검토 건만 시안에 담을 수 있어요");
  }
  const body = AdBody.parse({
    items: checks.map((c) => ({
      ad_check_id: c.id,
      input_excerpt: (c.input_text.split("\n")[0] ?? "").slice(0, EXCERPT_CHARS),
      overall_risk: c.overall_risk ?? null,
      overall_action: c.overall_action,
      is_expert_review_requested: c.is_expert_review_requested ?? false,
      final_text: c.final_text ?? null,
    })),
  });
  return {
    body,
    evidence: checks.map((c) => ({ kind: "ad_check", id: c.id })),
    data_as_of: latestOf(checks.map((c) => c.created_at)),
  };
}

type Appeal = NonNullable<ReviewBody["appeals"]>[number];
type Translation = NonNullable<ReviewBody["translations"]>[number];

/**
 * 시안에 담을 소구점. strict면 소구점 후보가 아닌 주제가 하나라도 있을 때 오류를 던지고,
 * strict가 아니면(이미 담은 것을 새로 고칠 때) 이제 후보가 아닌 주제는 조용히 뺀다.
 */
export async function buildAppeals(productId: string, topics: AppealTopic[], strict: boolean): Promise<Appeal[]> {
  const wanted = new Set(topics);
  if (wanted.size === 0) return [];
  const comparison = await getAppealComparison(productId);
  const rows = (comparison?.topics ?? []).filter((t) => t.isCandidate && wanted.has(t.topic));
  if (strict && rows.length !== wanted.size) throw new Error("소구점 후보가 아닌 주제가 있어요. 화면을 새로 고친 뒤 다시 골라 주세요");
  return rows.map((t) => ({
    topic: t.topic,
    own_praises: t.praises.length,
    competitor_complaints: t.complaints.length,
    evidence_review_ids: t.praises.slice(0, MAX_EVIDENCE_PER_ITEM).map((r) => r.id),
  }));
}

/**
 * 시안에 담을 일본어 후기. 이 제품의 번역이어야 하고, 고쳐야 할 표현이 남은 번역은 담을 수 없다.
 * strict가 아니면(이미 담은 것을 새로 고칠 때) 지워졌거나 다시 고쳐야 하게 된 번역은 조용히 뺀다.
 */
export async function buildTranslations(productId: string, ids: string[], strict: boolean): Promise<Translation[]> {
  const wanted = new Set(ids);
  if (wanted.size === 0) return [];
  const [translations, checks, reviews] = await Promise.all([
    getReviewTranslations(productId),
    getAdChecks({ source: "all" }),
    getReviewsOf(productId, { lang: "ko" }),
  ]);
  const checkById = new Map(checks.map((c) => [c.id, c]));
  const originalById = new Map(reviews.map((r) => [r.id, r.body]));
  const items: Translation[] = [];
  for (const t of translations.filter((x) => wanted.has(x.id))) {
    const check = t.ad_check_id ? checkById.get(t.ad_check_id) : undefined;
    if (translationNeedsFix(check)) {
      if (strict) throw new Error("고쳐야 할 표현이 남은 후기는 담을 수 없어요. 「이렇게 고치기」로 고친 뒤 담아 주세요");
      continue;
    }
    const original = originalById.get(t.review_id) ?? "";
    const textKo = check?.input_text ?? original;
    items.push({
      review_translation_id: t.id,
      review_id: t.review_id,
      ad_check_id: t.ad_check_id,
      text_ja: t.text_ja,
      text_ko: textKo,
      edited: textKo.replace(/\s+/g, " ").trim() !== original.replace(/\s+/g, " ").trim().slice(0, 500),
    });
  }
  if (strict && items.length !== wanted.size) throw new Error("이 제품의 번역이 아닌 후기가 있어요. 화면을 새로 고친 뒤 다시 골라 주세요");
  return items;
}

/** 리포트 스냅샷에 담은 소구점 · 후기를 붙이고, 그 후기들의 원문 리뷰도 근거에 더한다 */
export function withExtras(snapshot: VersionSnapshot<ReviewBody>, appeals: Appeal[], translations: Translation[]): VersionSnapshot<ReviewBody> {
  const body = ReviewBody.parse({ ...snapshot.body, appeals, translations });
  const cited = new Set([...snapshot.evidence.map((e) => e.id), ...translations.map((t) => t.review_id), ...appeals.flatMap((a) => a.evidence_review_ids)]);
  return { body, evidence: [...cited].map((id) => ({ kind: "review" as const, id })), data_as_of: snapshot.data_as_of };
}
