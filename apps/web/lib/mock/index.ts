import { activity } from "./activity";
import { adChecks } from "./ad-checks";
import { geoSnapshots } from "./geo";
import { platforms } from "./platforms";
import { products } from "./products";
import { promoEvents } from "./promo-events";
import { reviewAnalyses } from "./review-analyses";
import { reviewInsights } from "./review-insights";
import { reviewTranslations } from "./review-translations";
import { reviews } from "./reviews";
import { surveyProductLines, surveyQuestions } from "./survey";
import { survey, surveyMinorCounts, surveyResponses, surveySummary } from "./survey-responses";
import { trendSnapshots } from "./trends";
import { members, workspace } from "./workspace";

// 교차 참조 검사: 가리키는 ID가 모두 존재해야 한다. 실패하면 빌드가 멈춘다.
function checkRefs() {
  const ids = (rows: { id: string }[]) => new Set(rows.map((r) => r.id));
  const productIds = ids(products);
  const reviewIds = ids(reviews);
  const adCheckIds = ids(adChecks);
  const promoIds = ids(promoEvents);
  const userIds = new Set(members.map((m) => m.user_id));
  const errors: string[] = [];

  const expect = (ok: boolean, msg: string) => {
    if (!ok) errors.push(msg);
  };

  for (const r of reviews) expect(productIds.has(r.product_id), `reviews ${r.id}.product_id`);
  for (const a of reviewAnalyses) expect(reviewIds.has(a.review_id), `reviewAnalyses ${a.id}.review_id`);
  for (const i of reviewInsights) {
    expect(productIds.has(i.product_id), `reviewInsights ${i.id}.product_id`);
    for (const rid of i.evidence_review_ids) expect(reviewIds.has(rid), `reviewInsights ${i.id} evidence ${rid}`);
  }
  for (const t of reviewTranslations) {
    expect(reviewIds.has(t.review_id), `reviewTranslations ${t.id}.review_id`);
    if (t.ad_check_id) expect(adCheckIds.has(t.ad_check_id), `reviewTranslations ${t.id}.ad_check_id`);
  }
  for (const a of adChecks) {
    if (a.reviewer_id) expect(userIds.has(a.reviewer_id), `adChecks ${a.id}.reviewer_id`);
    if (a.product_id) expect(productIds.has(a.product_id), `adChecks ${a.id}.product_id`);
    if (a.promo_event_id) expect(promoIds.has(a.promo_event_id), `adChecks ${a.id}.promo_event_id`);
  }
  for (const p of platforms) expect(userIds.has(p.updated_by), `platforms ${p.id}.updated_by`);
  for (const a of activity) expect(userIds.has(a.actor_id), `activity ${a.id}.actor_id`);

  // 설문 집계가 가리키는 라인 · 연령대 · 고민 값이 문항과 추천 라인에 있어야 한다
  const lineIds = ids(surveyProductLines);
  const optionValues = (qid: string) => new Set(surveyQuestions.find((q) => q.id === qid)?.options.map((o) => o.value) ?? []);
  const ageValues = optionValues("age");
  const concernValues = optionValues("concerns");
  for (const l of surveySummary.product_lines) expect(lineIds.has(l.line_id), `surveySummary.product_lines ${l.line_id}`);
  for (const row of surveySummary.age_by_concern) {
    expect(ageValues.has(row.age_group), `surveySummary.age_by_concern ${row.age_group}`);
    for (const key of Object.keys(row.counts)) expect(concernValues.has(key), `surveySummary.age_by_concern ${row.age_group}.${key}`);
  }
  for (const r of surveyResponses) {
    expect(r.survey_id === survey.id, `surveyResponses ${r.id}.survey_id`);
    for (const c of r.concerns) expect(concernValues.has(c), `surveyResponses ${r.id}.concerns ${c}`);
  }
  for (const r of surveySummary.recent) {
    expect(ageValues.has(r.age_group), `surveySummary.recent ${r.at}.age_group`);
    for (const c of r.concerns) expect(concernValues.has(c), `surveySummary.recent ${r.at}.concerns ${c}`);
  }

  if (errors.length > 0) {
    throw new Error(`교차 참조 검사 실패:\n${errors.join("\n")}`);
  }
}

checkRefs();

export const mock = {
  workspace,
  members,
  products,
  reviews,
  reviewAnalyses,
  reviewInsights,
  reviewTranslations,
  adChecks,
  trendSnapshots,
  geoSnapshots,
  promoEvents,
  platforms,
  surveyQuestions,
  surveyProductLines,
  survey,
  surveyResponses,
  surveyMinorCounts,
  surveySummary,
  activity,
};
