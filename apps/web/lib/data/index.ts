import { PromoEvent } from "@/lib/schemas/promo";
import { PlatformNote } from "@/lib/schemas/platform";
import { dataContext, readRows, missingTableOnly } from "./db";
import { adCheckFromRow, productFromRow, reviewFromRow, analysisFromRow, summarizeReviews } from "./row-adapters";
import { getMyWorkspace, getMyWorkspaceMembers } from "./workspace";
import { TrendSnapshot } from "@/lib/schemas/trend";
import { SearchSnapshot } from "@/lib/schemas/search";
import { GeoSnapshot } from "@/lib/schemas/geo";
import { Project } from "@/lib/schemas/project";
import { ReviewTranslation } from "@/lib/schemas/review";
import { readSurveySummary } from "./survey";
// 화면이 부르는 읽기 함수 (prototype-plan 6.5).
// 연결 환경에서는 현재 팀의 DB를 읽는다. 환경 변수가 없는 개발 환경만 샘플을 쓴다.
import { mock } from "@/lib/mock";
import type { ReviewStatus, Lang, Sentiment } from "@/lib/schemas/common";
import { AdCheckLineRow, type AdCheckSource } from "@/lib/schemas/ad-check";
import { ContentGuideRow } from "@/lib/schemas/content-guide";
import { ProjectProduct } from "@/lib/schemas/project";
import type { TrendSource } from "@/lib/schemas/trend";
import { APPEAL_MAX_RATING, buildAppealComparison, reviewProductRank } from "./appeal";
import { importedSnapshots, importedSnsVideos } from "./market-imports";

export async function getWorkspace() {
  if (await dataContext()) return (await getMyWorkspace())!.workspace;
  return mock.workspace;
}

export async function getMembers() {
  const context = await dataContext();
  if (context) return getMyWorkspaceMembers(context.workspaceId);
  return mock.members;
}

export async function getMemberName(userId: string | null) {
  return (await getMembers()).find((m) => m.user_id === userId)?.display_name ?? "—";
}

export async function getProducts(opts: { kind?: "own" | "competitor" } = {}) {
  const rows = await readRows("products");
  return (rows ? rows.map(productFromRow) : mock.products).filter((p) => !opts.kind || p.kind === opts.kind);
}

export async function getProduct(id: string) {
  return (await getProducts()).find((p) => p.id === id) ?? null;
}

export async function getReviews(opts: { productId?: string; lang?: Lang; sentiment?: Sentiment } = {}) {
  const rows = await readRows("reviews");
  const analysisRows = rows ? await readRows("review_analyses") : null;
  const validAnalyses = analysisRows ? analysisRows.flatMap((row) => {
    const analysis = analysisFromRow(row);
    return analysis ? [analysis] : [];
  }) : mock.reviewAnalyses;
  const analyses = new Map(validAnalyses.map((a) => [a.review_id, a]));
  return (rows ? rows.map(reviewFromRow) : mock.reviews)
    .filter((r) => !r.excluded_reason && (!opts.productId || r.product_id === opts.productId) && (!opts.lang || r.lang === opts.lang))
    .map((r) => ({ ...r, analysis: analyses.get(r.id) ?? null }))
    .filter((r) => !opts.sentiment || r.analysis?.sentiment === opts.sentiment);
}

export async function getReviewReport(productId: string) {
  return summarizeReviews(await getReviews({ productId }));
}

/**
 * 소구점 찾기: 연결된 경쟁 제품의 일본어 저평점 리뷰와 자사 국내 리뷰를 비교한다. 샘플만 같은 카테고리 TOP10을 쓴다.
 * 경쟁 불만이 많고 + 자사 칭찬이 많고 + 자사 불만이 적은 주제가 소구점 후보다.
 */
export async function getAppealComparison(ownProductId: string, opts: { maxRating?: number } = {}) {
  const maxRating = opts.maxRating ?? APPEAL_MAX_RATING;
  const products = await getProducts();
  const own = products.find((p) => p.id === ownProductId && p.kind === "own");
  if (!own) return null;
  const links = await readRows("product_competitors");
  const linked = new Set((links ?? []).filter((r) => r.own_product_id === own.id).map((r) => r.competitor_product_id));
  const ranked = products.flatMap((p) => {
    const rank = reviewProductRank(p.source_raw);
    const matches = links ? linked.has(p.id) : p.platform === "qoo10" && p.category === own.category;
    return p.kind === "competitor" && matches && rank !== null ? [{ ...p, rank }] : [];
  }).sort((a, b) => a.rank - b.rank);
  // 실제 모드는 저장된 경쟁 연결 전체, 샘플 모드는 기존 TOP10 기준을 쓴다.
  const competitors = links ? ranked : ranked.slice(0, 10);
  const competitorIds = new Set(competitors.map((p) => p.id));
  const all = await getReviews();
  return buildAppealComparison({
    own, competitors, maxRating,
    ownReviews: all.filter((r) => r.product_id === own.id && r.lang === "ko"),
    lowReviews: all.filter((r) => competitorIds.has(r.product_id) && r.lang === "ja" && r.rating <= maxRating),
  });
}

export async function getReviewTranslations(productId: string) {
  if (await dataContext()) {
    // 연결 환경: DB의 번역만 보여 준다 (샘플을 실제 결과처럼 섞지 않는다). 테이블이 아직 없으면 빈 목록
    const rows = (await readRows("review_translations").catch(missingTableOnly)) ?? [];
    const reviewIds = new Set((await getReviews({ productId })).map((r) => r.id));
    return rows
      .flatMap((row) => {
        const parsed = ReviewTranslation.safeParse(row);
        return parsed.success && reviewIds.has(parsed.data.review_id) ? [parsed.data] : [];
      })
      .toSorted((a, b) => b.created_at.localeCompare(a.created_at));
  }
  const reviewIds = new Set(mock.reviews.filter((r) => r.product_id === productId).map((r) => r.id));
  return mock.reviewTranslations.filter((t) => reviewIds.has(t.review_id));
}

/** 검토 이력 출처: 직접 한 검토(manual, 기본) · 콘텐츠 가이드가 돌린 검사(content_guide) · 둘 다(all) */
export type AdCheckSourceFilter = AdCheckSource | "all";

export async function getAdChecks(opts: { status?: ReviewStatus; source?: AdCheckSourceFilter } = {}) {
  const source = opts.source ?? "manual";
  const [rows, lineRows] = await Promise.all([
    readRows("ad_checks").catch(missingTableOnly),
    readRows("ad_check_lines").catch(missingTableOnly),
  ]);
  // 샘플 데이터는 모두 직접 검토다
  if (!rows) return source === "content_guide" ? [] : mock.adChecks.filter((a) => !opts.status || a.review_status === opts.status);
  const linesByCheck = new Map<string, Record<string, unknown>[]>();
  for (const line of lineRows ?? []) {
    const checkId = String(line.ad_check_id ?? "");
    const list = linesByCheck.get(checkId) ?? [];
    list.push(line);
    linesByCheck.set(checkId, list);
  }
  return rows
    // 숨긴(deleted_at) 검토는 어디에도 보여 주지 않는다
    .filter((r) => !r.deleted_at && (source === "all" || (r.source ?? "manual") === source))
    .map((r) => adCheckFromRow(r, linesByCheck.get(String(r.id)) ?? []))
    .filter((a) => !opts.status || a.review_status === opts.status);
}

/** 상세는 출처와 관계없이 연다 (콘텐츠 가이드 검사도 보기는 가능) */
export async function getAdCheck(id: string) {
  return (await getAdChecks({ source: "all" })).find((a) => a.id === id) ?? null;
}

/** 만든 가이드 (content_guides). 샘플 모드에서는 저장된 결과물이 없다. 모양이 맞지 않는 행은 뺀다 */
export async function getContentGuides(): Promise<ContentGuideRow[]> {
  const rows = await readRows("content_guides").catch(missingTableOnly);
  if (!rows) return [];
  return rows
    .flatMap((r) => {
      const parsed = ContentGuideRow.safeParse(r);
      return parsed.success ? [parsed.data] : [];
    })
    .toSorted((a, b) => b.created_at.localeCompare(a.created_at));
}

/** 만든 가이드 하나와 그 약기법 검사의 블록별 판정 (block_key 가 있는 줄) */
export async function getContentGuide(id: string) {
  const guide = (await getContentGuides()).find((g) => g.id === id);
  if (!guide) return null;
  const lineRows = guide.ad_check_id ? ((await readRows("ad_check_lines").catch(missingTableOnly)) ?? []) : [];
  const checks = lineRows
    .filter((l) => l.ad_check_id === guide.ad_check_id)
    .flatMap((l) => {
      const parsed = AdCheckLineRow.safeParse(l);
      return parsed.success && parsed.data.block_key ? [{ key: parsed.data.block_key, action: parsed.data.action, findings: parsed.data.findings }] : [];
    });
  return { guide, checks };
}

/** source는 필수 (楽天·Qoo10 시계열이 섞이지 않게). category를 빼면 모든 카테고리. captured_at 오름차순 */
export async function getTrendSnapshots(opts: { source: TrendSource; category?: string }) {
  const rows = await readRows("trend_snapshots");
  const base = rows ? TrendSnapshot.array().parse(rows) : mock.trendSnapshots;
  // 이 PC의 수집 CSV(실데이터): 샘플 모드에서는 같은 플랫폼·카테고리 샘플을 대신하고, DB 모드에서는 DB에 없는 플랫폼·카테고리만 채운다
  const imported = importedSnapshots().filter((i) => !rows || !base.some((t) => t.source === i.source && t.category === i.category));
  const replaced = (t: { source: string; category: string }) => imported.some((i) => i.source === t.source && i.category === t.category);
  return [...base.filter((t) => !replaced(t)), ...imported]
    .filter((t) => t.source === opts.source)
    .filter((t) => !opts.category || t.category === opts.category)
    .toSorted((a, b) => a.captured_at.localeCompare(b.captured_at));
}

/** 검색 자동완성 스냅샷 (미래 트렌드). captured_at 오름차순 */
export async function getSearchSnapshots() {
  const rows = await readRows("search_snapshots");
  return (rows ? SearchSnapshot.array().parse(rows) : mock.searchSnapshots).toSorted((a, b) => a.captured_at.localeCompare(b.captured_at));
}

export async function getIngredientInterest(opts: { source: TrendSource; category: string }) {
  const latest = (await getTrendSnapshots(opts)).at(-1);
  return latest?.data.ingredients ?? [];
}

/** 마케터가 등록한 영상 메모 (수요 · SNS 공통 패턴) */
export async function getSnsVideoNotes() {
  if (await dataContext()) return []; // 저장 구조가 없는 샘플 결과를 실제 결과로 표시하지 않는다.
  return mock.snsVideoNotes;
}

/** 이 PC에 있는 실제 SNS 영상 목록 (수집 CSV, .gitignore). 없으면 빈 배열 */
export async function getImportedSnsVideos() {
  return importedSnsVideos();
}

/** 영상 메모에서 묶은 공통 패턴 (AI 결과 샘플) */
export async function getSnsPatterns() {
  if (await dataContext()) return []; // 저장 구조가 없는 샘플 결과를 실제 결과로 표시하지 않는다.
  return mock.snsPatterns;
}

export async function getGeoSnapshots() {
  const rows = await readRows("geo_snapshots");
  return rows ? GeoSnapshot.array().parse(rows) : mock.geoSnapshots;
}

export async function getPromoEvents(opts: { platform?: string } = {}) {
  const rows = await readRows("promo_events");
  const deadlines = rows ? await readRows("promo_milestones") : [];
  const events = rows ? rows.map((row) => {
    const milestones = (deadlines ?? []).filter((m) => m.promo_event_id === row.id);
    const dates = milestones.filter((m) => !m.done_at).map((m) => String(m.due_date)).sort();
    return PromoEvent.parse({ ...row, platform: row.platform_id ?? "", prep_due_date: dates[0] ?? row.start_date,
      milestones: milestones.map((m) => ({ label: m.label, due_date: m.due_date })) });
  }) : mock.promoEvents;
  return events
    .filter((e) => !opts.platform || e.platform === opts.platform)
    .toSorted((a, b) => a.start_date.localeCompare(b.start_date));
}

export async function getPlatforms() {
  const rows = await readRows("platform_notes");
  return rows ? rows.map((row) => PlatformNote.parse({ ...row, platform: row.platform_id,
    strengths: row.strengths ?? "", audience: row.audience ?? "", updated_by: row.updated_by ?? "",
    status: row.status ?? undefined })) : mock.platforms;
}

export async function getPlatform(id: string) {
  return (await getPlatforms()).find((p) => p.id === id) ?? null;
}

export async function getSurveyQuestions() {
  return mock.surveyQuestions;
}

export async function getSurveySummary() {
  return readSurveySummary();
}

export async function getSurveyProductLines() {
  return mock.surveyProductLines;
}

export type LibraryItem = { id: string; type: string; title: string; href: string; created_at: string };

/** 모든 모듈의 결과를 자료실 한 표로 (파생 데이터) */
export async function getLibraryItems(opts: { type?: string; q?: string } = {}) {
  const [checks, guides, products, geo] = await Promise.all([
    getAdChecks(),
    readRows("content_guides").catch(missingTableOnly),
    getProducts(),
    getGeoSnapshots(),
  ]);
  const items: LibraryItem[] = [
    ...checks.map((a) => ({ id: a.id, type: "광고 검토", title: a.input_text, href: `/ad-check/${a.id}`, created_at: a.created_at })),
    ...(guides ?? []).map((g) => {
      const titleObj = g.title as Record<string, unknown> | null;
      const titleText = String(titleObj?.title_ko ?? titleObj?.title_ja ?? g.title_ko ?? g.title_ja ?? "");
      return {
        id: String(g.id),
        type: "콘텐츠 가이드",
        title: titleText,
        href: `/ad-check/guide/history/${String(g.id)}`,
        created_at: String(g.created_at),
      };
    }),
    ...products.map((p) => ({ id: p.id, type: "제품", title: `${p.brand} ${p.name}`, href: `/market/competitors/${p.id}`, created_at: p.created_at })),
    ...geo.map((g) => ({ id: g.id, type: "GEO 측정", title: `${g.engine} · ${g.query}`, href: "/market#demand", created_at: g.created_at })),
  ];
  return items
    .filter((i) => !opts.type || i.type === opts.type)
    .filter((i) => !opts.q || i.title.includes(opts.q))
    .toSorted((a, b) => b.created_at.localeCompare(a.created_at));
}

/** 상단 헤더와 관리 화면이 공유하는 실제 프로젝트·제품 ID. */
export async function getProjectsWithProducts() {
  const rows = await readRows("projects");
  const products = await getProducts();
  return (rows ? Project.array().parse(rows) : mock.projects).map((project) => ({
    ...project,
    products: products
      .filter((p) => p.project_id === project.id)
      .map((p) => ProjectProduct.parse({ ...p, project_id: project.id, category: p.category ?? null })),
  }));
}

export async function getActivity() {
  if (await dataContext()) return []; // 저장 구조가 없는 샘플 결과를 실제 결과로 표시하지 않는다.
  return mock.activity.map((a) => ({
    ...a,
    actor_name: mock.members.find((m) => m.user_id === a.actor_id)?.display_name ?? "—",
  }));
}
