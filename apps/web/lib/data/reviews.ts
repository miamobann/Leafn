// 리뷰 탭(리포트 · 원문 목록 · 번역)이 부르는 읽기 함수 (서버 전용).
// DB(Supabase)가 연결돼 있고 워크스페이스가 있으면 DB의 products · reviews를 읽고, 아니면 기존 샘플(lib/mock)을 그대로 쓴다.
// 시장 분석·광고 검토 같은 다른 탭이 쓰는 getProducts/getReviews(lib/data/index.ts)는 건드리지 않는다. 그쪽은 샘플 제품 id(p-own-1)를 가리키기 때문이다.
// 읽는 리뷰는 제품 외 불만으로 제외되지 않은 것(excluded_reason is null)만이다. 리뷰마다 AI 분석 결과(review_analyses)를 함께 읽는다.
// 집계(review_insights)는 아직 DB에서 읽지 않는다.
import type { Lang } from "@/lib/schemas/common";
import type { SaleStatus, SkinLine } from "@/lib/schemas/project";
import { Review, ReviewAnalysis, type ReviewInsight } from "@/lib/schemas/review";
import { createClient } from "@/lib/supabase/server";
import { APPEAL_MAX_RATING, buildAppealComparison } from "./appeal";
import { getAppealComparison, getProduct, getProducts, getReviewReport, getReviews } from "./index";
import { getMyWorkspace, isSupabaseConfigured } from "./workspace";

export type ReviewProductView = {
  id: string;
  brand: string;
  name: string;
  kind: "own" | "competitor";
  ko: number;
  ja: number;
  /** 化粧水 · 美容液처럼 랭킹 카테고리 이름. 모르면 null */
  category: string | null;
  platform: string;
  /** 경쟁 제품의 랭킹 순위 (DB는 source_raw.rank, 샘플은 source_raw.qoo10_rank). 모르면 null */
  rank: number | null;
  /** 자사 제품의 피부 라인 · 판매 상태. 경쟁 제품은 null */
  skinLine: SkinLine | null;
  saleStatus: SaleStatus | null;
};
export type ReviewWithAnalysis = Review & { analysis: ReviewAnalysis | null };
export type ReviewReportView = {
  reviews: ReviewWithAnalysis[];
  insights: ReviewInsight[];
  sentiment: { positive: number; negative: number; neutral: number };
  /** AI 분석 결과가 하나라도 있는가. 없으면 감성 · 키워드 · 불만 유형 칸은 비어 있다 */
  analyzed: boolean;
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

const PAGE = 1000; // PostgREST가 한 번에 돌려주는 최대 행 수
const MAX_REVIEWS = 5000; // 한 제품에서 한 화면에 읽는 상한 (화면이 끝없이 길어지지 않게)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 테이블이 아직 없는 DB(마이그레이션 전)를 알아보는 표시. 이때는 샘플로 돌아간다 */
class TableMissing extends Error {}

function failed(what: string, error: { code?: string; message: string }): never {
  if (error.code === "PGRST205" || error.code === "42P01") throw new TableMissing();
  throw new Error(`${what}: ${error.message}`);
}

async function dbClient(): Promise<Supabase | null> {
  if (!isSupabaseConfigured() || !(await getMyWorkspace())) return null;
  return createClient();
}

/** DB를 쓸 수 있으면 DB로, 아니면(연결 없음 · 워크스페이스 없음 · 테이블 없음) 샘플로 읽는다 */
async function viaDb<T>(run: (supabase: Supabase) => Promise<T>, sample: () => Promise<T>): Promise<T> {
  const supabase = await dbClient();
  if (!supabase) return sample();
  try {
    return await run(supabase);
  } catch (error) {
    if (error instanceof TableMissing) return sample();
    throw error;
  }
}

/** 랭킹 순위. 수집 저장 함수(save_collection_run)는 source_raw.rank에, 샘플은 source_raw.qoo10_rank에 둔다 */
function rankOf(sourceRaw: unknown): number | null {
  const raw = sourceRaw as Record<string, unknown> | null;
  const rank = raw?.rank ?? raw?.qoo10_rank;
  return typeof rank === "number" ? rank : null;
}

function toReview(row: Record<string, unknown>): Review {
  return Review.parse({
    ...row,
    posted_at: row.posted_at ?? row.created_at, // 작성일을 모르는 리뷰는 저장한 시각으로 둔다
    body_ko: row.body_ko ?? undefined,
    reviewer_attrs: row.reviewer_attrs ?? undefined,
    rating_scale: row.rating_scale ?? undefined,
  });
}

/**
 * 리뷰 행에 함께 읽어 온 분석 결과(review_analyses)를 화면 모양으로 바꾼다.
 * 한 리뷰에 분석은 하나(unique review_id)지만 PostgREST는 배열로 줄 수도 있어 둘 다 받는다.
 * 모양이 스키마와 맞지 않는 분석은 버리고(분석 전으로 보임) 화면은 계속 보여준다.
 */
function toAnalysis(embedded: unknown): ReviewAnalysis | null {
  const row = Array.isArray(embedded) ? embedded[0] : embedded;
  if (!row || typeof row !== "object") return null;
  const value = row as Record<string, unknown>;
  const parsed = ReviewAnalysis.safeParse({ ...value, topics: value.topics ?? undefined }); // DB의 null = 아직 주제 분류 안 함
  return parsed.success ? parsed.data : null;
}

/** 한 제품의 리뷰와 분석. 낮은 별점부터, 같은 별점은 최근 것부터 */
async function selectReviews(supabase: Supabase, productId: string, lang?: Lang): Promise<ReviewWithAnalysis[]> {
  const rows: Record<string, unknown>[] = [];
  while (rows.length < MAX_REVIEWS) {
    let query = supabase.from("reviews").select("*, review_analyses(*)").eq("product_id", productId).is("excluded_reason", null);
    if (lang) query = query.eq("lang", lang);
    const { data, error } = await query
      .order("rating", { ascending: true })
      .order("posted_at", { ascending: false })
      .order("id", { ascending: true }) // 같은 별점 · 같은 날짜에서도 페이지 사이에 순서가 흔들리지 않게
      .range(rows.length, rows.length + PAGE - 1);
    if (error) failed("리뷰를 불러오지 못했습니다", error);
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows.map(({ review_analyses: embedded, ...row }) => ({ ...toReview(row), analysis: toAnalysis(embedded) }));
}

async function countReviews(supabase: Supabase, productId: string, lang: Lang): Promise<number> {
  const { count, error } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId)
    .eq("lang", lang)
    .is("excluded_reason", null);
  if (error) failed("리뷰 수를 세지 못했습니다", error);
  return count ?? 0;
}

/** 리포트 목록: 우리 제품과 저장한 경쟁 제품, 언어별 리뷰 수 */
export async function getReviewProductList(): Promise<ReviewProductView[]> {
  return viaDb(
    async (supabase) => {
      const { data, error } = await supabase
        .from("products")
        .select("id, brand, name, kind, category, platform_id, source_raw, skin_line, sale_status")
        .order("created_at", { ascending: true });
      if (error) failed("제품을 불러오지 못했습니다", error);
      const rows = await Promise.all(
        data.map(async (p) => ({
          id: p.id as string,
          brand: p.brand as string,
          name: p.name as string,
          kind: p.kind as "own" | "competitor",
          ko: await countReviews(supabase, p.id, "ko"),
          ja: await countReviews(supabase, p.id, "ja"),
          category: (p.category as string | null) ?? null,
          platform: p.platform_id as string,
          rank: rankOf(p.source_raw),
          skinLine: (p.skin_line as SkinLine | null) ?? null,
          saleStatus: (p.sale_status as SaleStatus | null) ?? null,
        })),
      );
      return rows.toSorted((a, b) => Number(b.kind === "own") - Number(a.kind === "own")); // 우리 제품이 먼저
    },
    async () => {
      const [products, reviews] = await Promise.all([getProducts(), getReviews()]);
      return products.map((p) => {
        const mine = reviews.filter((r) => r.product_id === p.id);
        return {
          id: p.id,
          brand: p.brand,
          name: p.name,
          kind: p.kind,
          ko: mine.filter((r) => r.lang === "ko").length,
          ja: mine.filter((r) => r.lang === "ja").length,
          category: p.category ?? null,
          platform: p.platform,
          rank: rankOf(p.source_raw),
          skinLine: p.skin_line,
          saleStatus: p.sale_status,
        };
      });
    },
  );
}

export async function getReviewProductById(id: string): Promise<{ id: string; brand: string; name: string; kind: "own" | "competitor" } | null> {
  return viaDb(
    async (supabase) => {
      if (!UUID.test(id)) return null; // 샘플 id(p-own-1)처럼 DB 제품이 아닌 주소
      const { data, error } = await supabase.from("products").select("id, brand, name, kind").eq("id", id).maybeSingle();
      if (error) failed("제품을 불러오지 못했습니다", error);
      return data ? { id: data.id, brand: data.brand, name: data.name, kind: data.kind as "own" | "competitor" } : null;
    },
    async () => {
      const p = await getProduct(id);
      return p ? { id: p.id, brand: p.brand, name: p.name, kind: p.kind } : null;
    },
  );
}

/** 한 제품의 리뷰 원문. 낮은 별점부터, 같은 별점은 최근 것부터 */
export async function getReviewsOf(productId: string, opts: { lang?: Lang } = {}): Promise<ReviewWithAnalysis[]> {
  return viaDb(
    async (supabase) => (UUID.test(productId) ? selectReviews(supabase, productId, opts.lang) : []),
    () => getReviews({ productId, lang: opts.lang }),
  );
}

export async function getReviewReportOf(productId: string): Promise<ReviewReportView> {
  return viaDb<ReviewReportView>(
    async (supabase) => {
      const reviews = UUID.test(productId) ? await selectReviews(supabase, productId) : [];
      const sentiment = { positive: 0, negative: 0, neutral: 0 };
      for (const r of reviews) if (r.analysis) sentiment[r.analysis.sentiment] += 1;
      return { reviews, insights: [], sentiment, analyzed: reviews.some((r) => r.analysis) };
    },
    async () => ({ ...(await getReviewReport(productId)), analyzed: true }),
  );
}

// ---- 소구점 찾기 ---------------------------------------------------------

export type AppealOwnView = { id: string; brand: string; name: string; category: string | null };
export type AppealCompetitorView = { id: string; brand: string; name: string; rank: number };
export type AppealComparisonView = ReturnType<typeof buildAppealComparison<AppealOwnView, AppealCompetitorView, ReviewWithAnalysis>>;

/**
 * 소구점 찾기: 자사 제품의 국내 칭찬 vs 그 제품의 경쟁 제품(일본) 낮은 별점 리뷰의 불만을 주제별로 비교한다.
 * DB에서 경쟁 제품은 수집 화면에서 이 자사 제품의 경쟁으로 저장한 것(product_competitors)이다. 순위가 있는 것만 순위순으로 쓴다.
 * 샘플에서는 같은 카테고리 Qoo10 랭킹 TOP10이다 (lib/data/index.ts getAppealComparison).
 */
export async function getAppealComparisonOf(ownProductId: string): Promise<AppealComparisonView | null> {
  const maxRating = APPEAL_MAX_RATING;
  return viaDb<AppealComparisonView | null>(
    async (supabase) => {
      if (!UUID.test(ownProductId)) return null;
      const { data: own, error: ownError } = await supabase
        .from("products")
        .select("id, brand, name, category")
        .eq("id", ownProductId)
        .eq("kind", "own")
        .maybeSingle();
      if (ownError) failed("자사 제품을 불러오지 못했습니다", ownError);
      if (!own) return null;

      const { data: links, error: linkError } = await supabase.from("product_competitors").select("competitor_product_id").eq("own_product_id", own.id);
      if (linkError) failed("경쟁 제품 연결을 불러오지 못했습니다", linkError);
      const ids = links.map((l) => l.competitor_product_id as string);

      let competitors: AppealCompetitorView[] = [];
      if (ids.length > 0) {
        const { data, error } = await supabase.from("products").select("id, brand, name, source_raw").in("id", ids).eq("kind", "competitor");
        if (error) failed("경쟁 제품을 불러오지 못했습니다", error);
        competitors = data
          .flatMap((p) => {
            const rank = rankOf(p.source_raw);
            return rank === null ? [] : [{ id: p.id as string, brand: p.brand as string, name: p.name as string, rank }];
          })
          .toSorted((a, b) => a.rank - b.rank);
      }

      const ownReviews = await selectReviews(supabase, own.id, "ko");
      const lowReviews = (await Promise.all(competitors.map((c) => selectReviews(supabase, c.id, "ja")))).flat().filter((r) => r.rating <= maxRating);
      return buildAppealComparison({
        own: { id: own.id as string, brand: own.brand as string, name: own.name as string, category: (own.category as string | null) ?? null },
        competitors,
        ownReviews,
        lowReviews,
        maxRating,
      });
    },
    async () => {
      const res = await getAppealComparison(ownProductId, { maxRating });
      if (!res) return null;
      return {
        ...res,
        own: { id: res.own.id, brand: res.own.brand, name: res.own.name, category: res.own.category ?? null },
        competitors: res.competitors.map((c) => ({ id: c.id, brand: c.brand, name: c.name, rank: c.rank, lowReviewCount: c.lowReviewCount })),
      };
    },
  );
}

/** 소구점 찾기 화면: 국내 리뷰가 있는 자사 제품마다 비교 결과 하나 */
export async function getAppealComparisons(): Promise<AppealComparisonView[]> {
  const own = (await getReviewProductList()).filter((p) => p.kind === "own" && p.ko > 0);
  const results = await Promise.all(own.map((p) => getAppealComparisonOf(p.id)));
  return results.filter((c): c is AppealComparisonView => c !== null && c.ownReviewCount > 0);
}
