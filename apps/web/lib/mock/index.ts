import { activity } from "./activity";
import { adChecks } from "./ad-checks";
import { geoSnapshots } from "./geo";
import { platforms } from "./platforms";
import { products } from "./products";
import { boardProjects, projectStages, projects } from "./projects";
import { searchSnapshots } from "./search";
import { snsPatterns, snsVideoNotes } from "./sns-notes";
import { promoEvents } from "./promo-events";
import { reviewAnalyses } from "./review-analyses";
import { reviewInsights } from "./review-insights";
import { reviewTranslations } from "./review-translations";
import { reviews } from "./reviews";
import { surveyProductLines, surveyQuestions } from "./survey";
import { survey, surveyMinorCounts, surveyResponses, surveySummary } from "./survey-responses";
import { trendSnapshots } from "./trends";
import { members, workspace } from "./workspace";
import { StageKey } from "@/lib/schemas/project";

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
  const boardProjectIds = ids(boardProjects);
  for (const p of boardProjects) {
    if (p.product_id) expect(productIds.has(p.product_id), `projects ${p.id}.product_id`);
    // 현황판 칸이 비지 않도록 프로젝트마다 8단계가 하나씩 있어야 한다
    const stages = new Set(projectStages.filter((s) => s.project_id === p.id).map((s) => s.stage));
    expect(StageKey.options.every((k) => stages.has(k)), `projects ${p.id} 단계 누락`);
  }
  for (const s of projectStages) {
    expect(boardProjectIds.has(s.project_id), `projectStages ${s.id}.project_id`);
    if (s.owner_id) expect(userIds.has(s.owner_id), `projectStages ${s.id}.owner_id`);
  }

  // 랭킹은 20위까지, 랭킹 항목이 가리키는 제품은 products에 있어야 하고 상품명 해석이 있어야 한다 (시장 분석 원페이지)
  for (const t of trendSnapshots) {
    expect(t.data.ranking.length <= 20, `trendSnapshots ${t.id} 랭킹이 20위를 넘음`);
    for (const r of t.data.ranking) {
      if (r.product_id) expect(productIds.has(r.product_id), `trendSnapshots ${t.id} ${r.rank}위 product_id ${r.product_id}`);
      expect(Boolean(r.name_ko), `trendSnapshots ${t.id} ${r.rank}위 ${r.name} name_ko 없음`);
      // Qoo10 랭킹은 products의 Qoo10 랭킹 제품(리뷰가 붙은 제품)과 같은 목록이어야 한다
      if (t.source === "qoo10_ranking") expect(Boolean(r.product_id), `trendSnapshots ${t.id} ${r.rank}위 ${r.name}가 products에 없음`);
    }
  }

  // SNS 공통 패턴이 가리키는 영상은 같은 카테고리의 영상 메모에 있어야 한다
  for (const p of snsPatterns)
    for (const vid of p.video_ids) {
      const note = snsVideoNotes.find((n) => n.id === vid);
      expect(Boolean(note), `snsPatterns ${p.id} 영상 ${vid}`);
      if (note) expect(note.category === p.category, `snsPatterns ${p.id} 영상 ${vid}의 카테고리가 다름`);
    }

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
  for (const r of surveySummary.responses) {
    expect(ageValues.has(r.age_group), `surveySummary.responses ${r.at}.age_group`);
    for (const c of r.concerns) expect(concernValues.has(c), `surveySummary.responses ${r.at}.concerns ${c}`);
  }

  // 제품이 가리키는 프로젝트(제품군)가 있어야 한다
  const projectIds = ids(projects);
  for (const p of products) if (p.project_id) expect(projectIds.has(p.project_id), `products ${p.id}.project_id`);

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
  searchSnapshots,
  snsVideoNotes,
  snsPatterns,
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
  projects,
  boardProjects,
  projectStages,
};
