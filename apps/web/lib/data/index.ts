// 화면이 부르는 읽기 함수 (prototype-plan 6.5).
// 화면은 lib/mock을 직접 import하지 않고 여기만 부른다. 나중에 같은 시그니처의 Supabase 쿼리로 바꾼다.
import { mock } from "@/lib/mock";
import type { ReviewStatus, Lang, Sentiment } from "@/lib/schemas/common";
import { StageKey } from "@/lib/schemas/project";
import type { TrendSource } from "@/lib/schemas/trend";

export async function getWorkspace() {
  return mock.workspace;
}

export async function getMembers() {
  return mock.members;
}

export async function getMemberName(userId: string | null) {
  return mock.members.find((m) => m.user_id === userId)?.display_name ?? "—";
}

export async function getProducts(opts: { kind?: "own" | "competitor" } = {}) {
  return mock.products.filter((p) => !opts.kind || p.kind === opts.kind);
}

export async function getProduct(id: string) {
  return mock.products.find((p) => p.id === id) ?? null;
}

export async function getReviews(opts: { productId?: string; lang?: Lang; sentiment?: Sentiment } = {}) {
  return mock.reviews
    .filter((r) => !opts.productId || r.product_id === opts.productId)
    .filter((r) => !opts.lang || r.lang === opts.lang)
    .map((r) => ({ ...r, analysis: mock.reviewAnalyses.find((a) => a.review_id === r.id) ?? null }))
    .filter((r) => !opts.sentiment || r.analysis?.sentiment === opts.sentiment);
}

export async function getReviewReport(productId: string) {
  const reviews = await getReviews({ productId });
  const insights = mock.reviewInsights.filter((i) => i.product_id === productId);
  const sentiment = { positive: 0, negative: 0, neutral: 0 };
  for (const r of reviews) if (r.analysis) sentiment[r.analysis.sentiment] += 1;
  return { reviews, insights, sentiment };
}

/** 국내 리뷰의 칭찬(자사)과 일본 리뷰의 불만(경쟁)을 나란히 (소구점 찾기) */
export async function getAppealCandidates() {
  const own = mock.products.filter((p) => p.kind === "own").map((p) => p.id);
  return {
    strengths: mock.reviewInsights.filter((i) => own.includes(i.product_id) && i.kind === "repurchase_factor"),
    complaints: mock.reviewInsights.filter((i) => !own.includes(i.product_id) && i.kind === "pain_point"),
  };
}

export async function getReviewTranslations(productId: string) {
  const reviewIds = new Set(mock.reviews.filter((r) => r.product_id === productId).map((r) => r.id));
  return mock.reviewTranslations.filter((t) => reviewIds.has(t.review_id));
}

export async function getAdChecks(opts: { status?: ReviewStatus } = {}) {
  return mock.adChecks.filter((a) => !opts.status || a.review_status === opts.status);
}

export async function getAdCheck(id: string) {
  return mock.adChecks.find((a) => a.id === id) ?? null;
}

/** source는 필수 (楽天·Qoo10 시계열이 섞이지 않게). category를 빼면 모든 카테고리. captured_at 오름차순 */
export async function getTrendSnapshots(opts: { source: TrendSource; category?: string }) {
  return mock.trendSnapshots
    .filter((t) => t.source === opts.source)
    .filter((t) => !opts.category || t.category === opts.category)
    .toSorted((a, b) => a.captured_at.localeCompare(b.captured_at));
}

/** 이미지 분석의 입력 (크롤러 결과). 지금은 더미, 크롤러가 생기면 DB에서 읽는다 */
export async function getRankingSources(opts: { source: TrendSource; category: string }) {
  return mock.rankingSources.filter((r) => r.source === opts.source && r.category === opts.category).toSorted((a, b) => a.rank - b.rank);
}

/** 검색 자동완성 스냅샷 (미래 트렌드). captured_at 오름차순 */
export async function getSearchSnapshots() {
  return mock.searchSnapshots.toSorted((a, b) => a.captured_at.localeCompare(b.captured_at));
}

export async function getIngredientInterest(opts: { source: TrendSource; category: string }) {
  const latest = (await getTrendSnapshots(opts)).at(-1);
  return latest?.data.ingredients ?? [];
}

export async function getGeoSnapshots() {
  return mock.geoSnapshots;
}

export async function getPromoEvents(opts: { platform?: string } = {}) {
  return mock.promoEvents
    .filter((e) => !opts.platform || e.platform === opts.platform)
    .toSorted((a, b) => a.start_date.localeCompare(b.start_date));
}

export async function getPlatforms() {
  return mock.platforms;
}

export async function getPlatform(id: string) {
  return mock.platforms.find((p) => p.id === id) ?? null;
}

export async function getSurveyQuestions() {
  return mock.surveyQuestions;
}

export async function getSurveySummary() {
  return mock.surveySummary;
}

export type LibraryItem = { id: string; type: string; title: string; href: string; created_at: string };

/** 모든 모듈의 결과를 자료실 한 표로 (파생 데이터) */
export async function getLibraryItems(opts: { type?: string; q?: string } = {}) {
  const items: LibraryItem[] = [
    ...mock.adChecks.map((a) => ({ id: a.id, type: "광고 검토", title: a.input_text, href: `/ad-check/${a.id}`, created_at: a.created_at })),
    ...mock.products.map((p) => ({ id: p.id, type: "제품", title: `${p.brand} ${p.name}`, href: `/market/competitors/${p.id}`, created_at: p.created_at })),
    ...mock.geoSnapshots.map((g) => ({ id: g.id, type: "GEO 측정", title: `${g.engine} · ${g.query}`, href: "/market/geo", created_at: g.created_at })),
  ];
  return items
    .filter((i) => !opts.type || i.type === opts.type)
    .filter((i) => !opts.q || i.title.includes(opts.q))
    .toSorted((a, b) => b.created_at.localeCompare(a.created_at));
}

/** 홈 진행 현황판: 프로젝트(자사 제품 하나)마다 8단계를 업무 흐름 순서로, 담당자 이름과 함께 */
export async function getProjects() {
  return mock.projects.map((p) => ({
    ...p,
    stages: mock.projectStages
      .filter((s) => s.project_id === p.id)
      .toSorted((a, b) => StageKey.options.indexOf(a.stage) - StageKey.options.indexOf(b.stage))
      .map((s) => ({ ...s, owner_name: mock.members.find((m) => m.user_id === s.owner_id)?.display_name ?? null })),
  }));
}

export async function getActivity() {
  return mock.activity.map((a) => ({
    ...a,
    actor_name: mock.members.find((m) => m.user_id === a.actor_id)?.display_name ?? "—",
  }));
}
