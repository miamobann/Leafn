// 플랫폼 수집(리뷰 가져오기) 화면이 부르는 DB 읽기 함수 (서버 전용). 로그인한 사용자의 세션으로 읽으므로 RLS가 워크스페이스를 가른다.
// 화면은 아래 View 타입만 안다. 수집기가 쓴 임시(대기) 리뷰와 이미 저장된 리뷰를 세어 "저장 안 함 / 일부 저장 / 모두 저장됨"의 재료를 만든다.
import { CollectionRunProductRow, CollectionRunRow, type CollectionRunStatus, CollectionSkippedRow, type SkipReason } from "@/lib/schemas/collection";
import { createClient } from "@/lib/supabase/server";
import { getMyWorkspace, isSupabaseConfigured } from "./workspace";

export type CollectProject = {
  id: string;
  brand: string;
  name: string;
  category: string;
  volumeMl: number | null;
  priceJpy: number | null;
};

/** 체크한 별점 하나의 상태 */
export type StarView = {
  star: number;
  /** 이미 DB에 저장된 이 별점 리뷰 수 (제품 외 불만으로 제외된 것은 뺀다) */
  saved: number;
  /** 이번에 새로 저장할 수 있는 이 별점 리뷰 수 */
  newCount: number;
  /** 수집기가 이 별점을 읽은 수 (이미 가진 것 포함). 못 읽었으면 null */
  read: number | null;
  /** 이 별점 구간 끝까지 읽었는가. true면 read가 정확한 수, false면 "그 수 이상". 모르면 null */
  exhausted: boolean | null;
};

export type CollectionRowView = {
  /** collection_run_products.id. 저장할 제품을 고를 때 이 값으로 가른다 */
  id: string;
  rank: number;
  brand: string;
  name: string;
  isSet: boolean;
  /** 사이트가 표시하는 전체 리뷰 수. 못 읽었으면 null */
  siteCount: number | null;
  /** 체크한 별점의 리뷰를 읽은 수(이미 가진 것 포함). lowExact가 false면 "그 수 이상"이다 */
  lowCount: number | null;
  lowExact: boolean | null;
  /** 이미 DB에 저장된 리뷰 수 (모든 별점, 제품 외 불만으로 제외된 것은 뺀다). 0이면 이전에 저장한 적이 없다 */
  savedCount: number;
  /** 이번에 새로 저장할 수 있는 리뷰 수 (체크한 별점 전체, 임시 리뷰 중 제외되지 않은 것) */
  newCount: number;
  /** 체크한 별점마다의 상태 (별점 오름차순) */
  stars: StarView[];
  lastSaved: string | null;
  failed: boolean;
  note: string | null;
  /** 방금 저장으로 새로 들어간 수 (저장이 끝난 요청에서만) */
  savedNow: number | null;
};

export type CollectionView = {
  run: {
    id: string;
    status: CollectionRunStatus;
    error: string | null;
    platformId: string;
    category: string;
    topN: number;
    /** 체크한 별점 */
    stars: number[];
    /** 별점마다 새로 가져올 건수 */
    reviewLimit: number;
    createdAt: string;
    savedCount: number | null;
    /** 수집 중 진행 (제품 단위). 수집기가 아직 적지 않았으면 null → 화면은 숫자 없이 "읽고 있어요"만 보여 준다 */
    progress: { done: number; total: number; note: string | null } | null;
  };
  rows: CollectionRowView[];
  /** 비교 대상이 아니라 수집기가 자동으로 뺀 제품 (리뷰는 읽지 않았다). 순위순 */
  skipped: { id: string; rank: number; brand: string; name: string; reason: SkipReason }[];
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const RUN_COLUMNS =
  "id, created_at, platform_id, category, own_product_id, top_n, stars, review_limit, status, error, finished_at, saved_count, progress_total, progress_done, progress_note";
const PRODUCT_COLUMNS = "id, rank, external_id, brand, title, is_set, status, site_total_count, site_low_count, site_low_count_exact, star_counts, error, saved_count";

type Counted = PromiseLike<{ count: number | null; error: { message: string } | null }>;

async function countOf(query: Counted): Promise<number> {
  const { count, error } = await query;
  if (error) throw new Error(`리뷰 수를 세지 못했습니다: ${error.message}`);
  return count ?? 0;
}

/** 우리 제품(자사). 화면의 "우리 제품" 드롭다운. 연결이 없거나 워크스페이스가 없으면 빈 목록 */
export async function getCollectionOwnProducts(): Promise<CollectProject[]> {
  if (!isSupabaseConfigured()) return [];
  const mine = await getMyWorkspace();
  if (!mine) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, brand, name, category, volume_ml, price_jpy")
    .eq("workspace_id", mine.workspace.id)
    .eq("kind", "own")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`우리 제품을 불러오지 못했습니다: ${error.message}`);
  return data.map((p) => ({
    id: p.id,
    brand: p.brand,
    name: p.name,
    category: p.category ?? "",
    volumeMl: p.volume_ml === null ? null : Number(p.volume_ml),
    priceJpy: p.price_jpy,
  }));
}

/** 수집 요청 한 건을 화면용으로 만든다. 미리보기(ready) 요청이면 제품마다 임시 리뷰 수와 이미 저장된 수를 센다 */
export async function buildCollectionView(supabase: Supabase, runRaw: unknown): Promise<CollectionView> {
  const run = CollectionRunRow.parse(runRaw);
  const { data, error } = await supabase.from("collection_run_products").select(PRODUCT_COLUMNS).eq("run_id", run.id).order("rank", { ascending: true });
  if (error) throw new Error(`수집 결과를 불러오지 못했습니다: ${error.message}`);
  const products = data.map((p) => CollectionRunProductRow.parse(p));

  // 자동으로 뺀 제품. 테이블이 아직 없는 DB(마이그레이션 전)면 빈 목록으로 둔다
  const skippedResult = await supabase.from("collection_run_skipped").select("id, rank, brand, title, reason").eq("run_id", run.id).order("rank", { ascending: true });
  if (skippedResult.error && skippedResult.error.code !== "PGRST205" && skippedResult.error.code !== "42P01") {
    throw new Error(`뺀 제품을 불러오지 못했습니다: ${skippedResult.error.message}`);
  }
  const skipped = (skippedResult.data ?? []).map((r) => CollectionSkippedRow.parse(r));

  const needsCounts = run.status === "ready" || run.status === "saved";
  // 이미 저장한 적 있는 제품: products에 같은 (플랫폼, 제품 번호)가 있으면 저장 이력이 있다. 별점마다 저장된 수도 센다
  const history = new Map<string, { savedCount: number; savedByStar: Map<number, number>; lastSaved: string | null }>();
  if (needsCounts && products.length > 0) {
    const { data: known, error: knownError } = await supabase
      .from("products")
      .select("id, external_id, collected_at")
      .eq("platform_id", run.platform_id)
      .eq("kind", "competitor")
      .in("external_id", products.map((p) => p.external_id));
    if (knownError) throw new Error(`저장 이력을 불러오지 못했습니다: ${knownError.message}`);
    await Promise.all(
      (known ?? []).map(async (k) => {
        const saved = () => supabase.from("reviews").select("id", { count: "exact", head: true }).eq("product_id", k.id).is("excluded_reason", null);
        const [savedCount, ...byStar] = await Promise.all([countOf(saved()), ...run.stars.map((star) => countOf(saved().eq("rating", star)))]);
        history.set(k.external_id as string, { savedCount, savedByStar: new Map(run.stars.map((star, i) => [star, byStar[i]])), lastSaved: k.collected_at });
      }),
    );
  }
  // 이번에 새로 저장할 수 있는 리뷰 = 수집기가 임시로 둔 리뷰 중 제외되지 않은 것. 별점별로 센다 (제품당 별점 수 × 건수 = 많아야 수백 행)
  const staged = new Map<string, Map<number, number>>();
  if (run.status === "ready") {
    await Promise.all(
      products.map(async (p) => {
        const { data: rows, error: stagedError } = await supabase
          .from("collection_staged_reviews")
          .select("rating")
          .eq("run_product_id", p.id)
          .is("excluded_reason", null)
          .limit(1000);
        if (stagedError) throw new Error(`임시 리뷰를 세지 못했습니다: ${stagedError.message}`);
        const byStar = new Map<number, number>();
        for (const row of rows) byStar.set(Math.round(Number(row.rating)), (byStar.get(Math.round(Number(row.rating))) ?? 0) + 1);
        staged.set(p.id, byStar);
      }),
    );
  }

  return {
    run: {
      id: run.id,
      status: run.status,
      error: run.error,
      platformId: run.platform_id,
      category: run.category,
      topN: run.top_n,
      stars: run.stars.toSorted((a, b) => a - b),
      reviewLimit: run.review_limit,
      createdAt: run.created_at,
      savedCount: run.saved_count,
      progress: run.progress_total === null ? null : { done: run.progress_done ?? 0, total: run.progress_total, note: run.progress_note },
    },
    rows: products.map((p) => ({
      id: p.id,
      rank: p.rank,
      brand: p.brand,
      name: p.title,
      isSet: p.is_set,
      siteCount: p.site_total_count,
      lowCount: p.site_low_count,
      lowExact: p.site_low_count_exact,
      savedCount: history.get(p.external_id)?.savedCount ?? 0,
      newCount: [...(staged.get(p.id)?.values() ?? [])].reduce((sum, count) => sum + count, 0),
      stars: run.stars
        .toSorted((a, b) => a - b)
        .map((star) => ({
          star,
          saved: history.get(p.external_id)?.savedByStar.get(star) ?? 0,
          newCount: staged.get(p.id)?.get(star) ?? 0,
          read: p.star_counts?.[String(star)]?.read ?? null,
          exhausted: p.star_counts?.[String(star)]?.exhausted ?? null,
        })),
      lastSaved: history.get(p.external_id)?.lastSaved ?? null,
      failed: p.status === "failed",
      note: p.status === "failed" ? p.error : null,
      savedNow: run.status === "saved" ? p.saved_count : null,
    })),
    skipped: skipped.map((r) => ({ id: r.id, rank: r.rank, brand: r.brand, name: r.title, reason: r.reason })),
  };
}

/** 이 우리 제품의 가장 최근 수집 요청. 저장이 끝난 요청이면 새로 시작하도록 null */
export async function getOpenCollection(ownProductId: string): Promise<CollectionView | null> {
  if (!isSupabaseConfigured()) return null;
  const mine = await getMyWorkspace();
  if (!mine) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("collection_runs")
    .select(RUN_COLUMNS)
    .eq("workspace_id", mine.workspace.id)
    .eq("own_product_id", ownProductId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`수집 요청을 불러오지 못했습니다: ${error.message}`);
  if (!data || data.status === "saved") return null;
  return buildCollectionView(supabase, data);
}
