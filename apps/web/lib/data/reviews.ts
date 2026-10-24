// 리뷰 탭(리포트 · 원문 목록 · 번역)이 부르는 읽기 함수 (서버 전용).
// DB(Supabase)가 연결돼 있고 워크스페이스가 있으면 DB의 products · reviews를 읽고, 아니면 기존 샘플(lib/mock)을 그대로 쓴다.
// 시장 분석·광고 검토 같은 다른 탭이 쓰는 getProducts/getReviews(lib/data/index.ts)는 건드리지 않는다. 그쪽은 샘플 제품 id(p-own-1)를 가리키기 때문이다.
// 읽는 리뷰는 제품 외 불만으로 제외되지 않은 것(excluded_reason is null)만이다. 분석 결과(review_analyses)와 집계(review_insights)는 아직 DB에서 읽지 않는다.
import type { Lang } from "@/lib/schemas/common";
import { Review, type ReviewAnalysis, type ReviewInsight } from "@/lib/schemas/review";
import { createClient } from "@/lib/supabase/server";
import { getProduct, getProducts, getReviewReport, getReviews } from "./index";
import { getMyWorkspace, isSupabaseConfigured } from "./workspace";

export type ReviewProductView = { id: string; brand: string; name: string; kind: "own" | "competitor"; ko: number; ja: number };
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

function toReview(row: Record<string, unknown>): Review {
  return Review.parse({
    ...row,
    posted_at: row.posted_at ?? row.created_at, // 작성일을 모르는 리뷰는 저장한 시각으로 둔다
    body_ko: row.body_ko ?? undefined,
    reviewer_attrs: row.reviewer_attrs ?? undefined,
    rating_scale: row.rating_scale ?? undefined,
  });
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
      const { data, error } = await supabase.from("products").select("id, brand, name, kind").order("created_at", { ascending: true });
      if (error) failed("제품을 불러오지 못했습니다", error);
      const rows = await Promise.all(
        data.map(async (p) => ({
          id: p.id as string,
          brand: p.brand as string,
          name: p.name as string,
          kind: p.kind as "own" | "competitor",
          ko: await countReviews(supabase, p.id, "ko"),
          ja: await countReviews(supabase, p.id, "ja"),
        })),
      );
      return rows.toSorted((a, b) => Number(b.kind === "own") - Number(a.kind === "own")); // 우리 제품이 먼저
    },
    async () => {
      const [products, reviews] = await Promise.all([getProducts(), getReviews()]);
      return products.map((p) => {
        const mine = reviews.filter((r) => r.product_id === p.id);
        return { id: p.id, brand: p.brand, name: p.name, kind: p.kind, ko: mine.filter((r) => r.lang === "ko").length, ja: mine.filter((r) => r.lang === "ja").length };
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
    async (supabase) => {
      if (!UUID.test(productId)) return [];
      const rows: Record<string, unknown>[] = [];
      while (rows.length < MAX_REVIEWS) {
        let query = supabase.from("reviews").select("*").eq("product_id", productId).is("excluded_reason", null);
        if (opts.lang) query = query.eq("lang", opts.lang);
        const { data, error } = await query
          .order("rating", { ascending: true })
          .order("posted_at", { ascending: false })
          .order("id", { ascending: true }) // 같은 별점 · 같은 날짜에서도 페이지 사이에 순서가 흔들리지 않게
          .range(rows.length, rows.length + PAGE - 1);
        if (error) failed("리뷰를 불러오지 못했습니다", error);
        rows.push(...data);
        if (data.length < PAGE) break;
      }
      return rows.map((row) => ({ ...toReview(row), analysis: null })); // AI 분석 결과는 아직 DB에서 읽지 않는다
    },
    () => getReviews({ productId, lang: opts.lang }),
  );
}

export async function getReviewReportOf(productId: string): Promise<ReviewReportView> {
  return viaDb<ReviewReportView>(
    async () => ({ reviews: await getReviewsOf(productId), insights: [], sentiment: { positive: 0, negative: 0, neutral: 0 }, analyzed: false }),
    async () => ({ ...(await getReviewReport(productId)), analyzed: true }),
  );
}
