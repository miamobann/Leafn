import { z } from "zod";
import { Id } from "./common";

// 플랫폼 수집 요청 (collection_runs · collection_run_products). 마이그레이션: 20261023211500, 20261024020000
// 화면이 만든 queued 요청을 수집기(일꾼)가 집어 가서 ready(미리보기)로 만든다. 웹과 수집기는 DB로만 만난다 (CLAUDE.md 3장).

export const CollectionPlatform = z.enum(["qoo10", "rakuten"]);
export const CollectionCategory = z.enum(["toner", "serum"]);

/** [경쟁 제품 불러오기]가 서버로 보내는 값. 화면의 드롭다운과 1:1이다 */
export const StartCollectionInput = z.object({
  ownProductId: Id,
  platformId: CollectionPlatform,
  category: CollectionCategory,
  topN: z.number().int().min(1).max(50),
  /** 가져올 별점 (화면의 체크박스). 체크한 별점마다 따로 읽는다 */
  stars: z
    .array(z.number().int().min(1).max(5))
    .min(1)
    .max(5)
    .refine((stars) => new Set(stars).size === stars.length, "같은 별점이 두 번 들어 있어요"),
  /** 별점마다 새로 가져올 건수. 이미 저장한 리뷰는 건너뛰고 아직 없는 리뷰를 최신순으로 이만큼 모은다 */
  reviewLimit: z.number().int().min(1).max(200),
});
export type StartCollectionInput = z.infer<typeof StartCollectionInput>;

export const CollectionRunStatus = z.enum(["queued", "running", "ready", "saved", "failed"]);
export type CollectionRunStatus = z.infer<typeof CollectionRunStatus>;

// 시각은 문자열 그대로 둔다 (DB가 돌려주는 마이크로초 표기를 그대로 받으려고)
export const CollectionRunRow = z.object({
  id: Id,
  created_at: z.string(),
  platform_id: z.string(),
  category: z.string(),
  own_product_id: Id.nullable(),
  top_n: z.number(),
  stars: z.array(z.number()),
  review_limit: z.number(),
  status: CollectionRunStatus,
  error: z.string().nullable(),
  finished_at: z.string().nullable(),
  saved_count: z.number().nullable(),
  // 진행 표시 (마이그레이션 20261026210000). 수집기가 아직 쓰지 않았으면 null
  progress_total: z.number().nullable(),
  progress_done: z.number().nullable(),
  progress_note: z.string().nullable(),
});
export type CollectionRunRow = z.infer<typeof CollectionRunRow>;

// 별점별 수집 결과 (collection_run_products.star_counts, 마이그레이션 20261024040000). read는 이미 가진 리뷰를 포함한 수다
export const StarCount = z.object({
  start_page: z.number().nullable(),
  read: z.number(),
  skipped_known: z.number(),
  new: z.number(),
  exhausted: z.boolean(),
});
export type StarCount = z.infer<typeof StarCount>;

export const CollectionRunProductRow = z.object({
  id: Id,
  rank: z.number(),
  external_id: z.string(),
  brand: z.string(),
  title: z.string(),
  is_set: z.boolean(),
  status: z.enum(["queued", "running", "done", "partial", "failed"]),
  site_total_count: z.number().nullable(),
  site_low_count: z.number().nullable(),
  site_low_count_exact: z.boolean().nullable(),
  star_counts: z.record(z.string(), StarCount).nullable(),
  error: z.string().nullable(),
  saved_count: z.number().nullable(),
});
export type CollectionRunProductRow = z.infer<typeof CollectionRunProductRow>;

// 비교 대상이 아니라 수집기가 자동으로 뺀 제품 (collection_run_skipped, 마이그레이션 20261024030000). 리뷰는 읽지 않았고 화면은 보기만 한다
export const SkipReason = z.enum(["set", "multi_type", "not_toner"]);
export type SkipReason = z.infer<typeof SkipReason>;

export const CollectionSkippedRow = z.object({
  id: Id,
  rank: z.number(),
  brand: z.string(),
  title: z.string(),
  reason: SkipReason,
});
export type CollectionSkippedRow = z.infer<typeof CollectionSkippedRow>;
