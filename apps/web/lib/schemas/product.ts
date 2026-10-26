import { z } from "zod";
import { PlatformId } from "../platforms";
import { Id, Timestamp, WorkspaceRow } from "./common";
import { SaleStatus, SkinLine } from "./project";

/**
 * AI가 긴 제품명(주로 Qoo10 일본어 제목)을 정리한 결과. 원문은 Product.name에 그대로 있다.
 * 값은 모두 제목에 적힌 것만 쓰고, 제목에 없으면 null이다 (prompts/product-title.v1.md)
 */
export const ProductTitleAi = z.object({
  brand_ko: z.string().nullable(),
  name_short_ja: z.string(),
  name_ko: z.string(),
  volume: z.string().nullable(),
  key_ingredient_ja: z.string().nullable(),
  key_ingredient_ko: z.string().nullable(),
  model: z.string(),
  prompt_version: z.string(),
});
export type ProductTitleAi = z.infer<typeof ProductTitleAi>;

export const Product = WorkspaceRow.extend({
  kind: z.enum(["own", "competitor"]),
  brand: z.string(),
  name: z.string(),
  platform: PlatformId, // platforms의 slug (DB_RULES 4.2)
  url: z.string().url().nullable(),
  price_jpy: z.number().int().nonnegative().nullable(),
  volume_ml: z.number().positive().nullable(),
  ingredients: z.array(z.string()),
  features: z.array(z.string()),
  image_path: z.string().nullable(),
  source_raw: z.record(z.string(), z.unknown()).nullable(),
  // 제안: docs/prototype-plan.md 8장 11번 (정가·행사가 구분), 15번 (카테고리)
  price_kind: z.enum(["regular", "sale"]).optional(),
  category: z.string().optional(),
  // 프로젝트(제품군)에 속한 자사 제품이면 채운다 (2026-10-24 총괄 결정). 경쟁 제품은 null
  // 이 칸을 모르는 기존 화면(경쟁제품 등록 등)이 안 깨지게 빠지면 null로 채운다
  project_id: Id.nullable().default(null),
  sale_status: SaleStatus.nullable().default(null),
  skin_line: SkinLine.nullable().default(null),
  // 정리 전이거나 모양이 틀리면 null → 화면은 원문 제품명을 보여 준다 (이 칸 때문에 제품 전체가 읽히지 않는 일이 없게 .catch)
  title_ai: ProductTitleAi.nullable().catch(null),
});
export type Product = z.infer<typeof Product>;

/**
 * source_raw 중 경쟁제품 비교·제품 상세가 꺼내 쓰는 값 (DB_RULES 2.1: 한 화면에서만 쓰는 수집 값은 raw에 둔다).
 * 수집기마다 모양이 달라질 수 있어 화면은 readListing()으로만 읽는다. 평점 척도는 플랫폼마다 다르다 (@cosme 7점은 확인 필요).
 */
export const ProductListing = z.object({
  rating: z.number().nonnegative().nullable(),
  rating_scale: z.number().int().positive(),
  review_count: z.number().int().nonnegative(),
  sale_price_jpy: z.number().int().nonnegative().nullable(),
  sale_label: z.string().nullable(),
  captured_at: Timestamp,
});
export type ProductListing = z.infer<typeof ProductListing>;

export function readListing(p: Pick<Product, "source_raw">): ProductListing | null {
  const parsed = ProductListing.safeParse(p.source_raw);
  return parsed.success ? parsed.data : null;
}

/**
 * 자사 제품 규격 (source_raw.spec). 제품규격서에서 옮긴 값이고, 아직 화면 한두 곳에서만 쓰여 컬럼 대신 raw에 둔다 (DB_RULES 2.1).
 * 가격·용량·全成分(일본어)·특징은 products의 칸에 있고, 여기는 그 밖의 값이다. 값은 lib/own-product-specs.ts
 */
const LineCopy = z.object({ main_ja: z.string(), sub_ja: z.string(), claim_ja: z.string() });
export const OwnProductSpec = z.object({
  source: z.string(),
  name_ja: z.string(),
  type_ja: z.string(),
  type_ko: z.string(),
  summary_ko: z.string(),
  texture_ko: z.string(),
  look_ko: z.string(),
  feel_ja: z.string(),
  feel_ko: z.string(),
  main_actives: z.array(z.string()),
  sub_actives: z.array(z.string()),
  container_ko: z.string(),
  ingredients_ko: z.array(z.string()),
  line_copy: LineCopy,
});
export type OwnProductSpec = z.infer<typeof OwnProductSpec>;

export function readOwnSpec(p: Pick<Product, "source_raw">): OwnProductSpec | null {
  const parsed = OwnProductSpec.safeParse(p.source_raw?.spec);
  return parsed.success ? parsed.data : null;
}

/** ml당 가격은 저장하지 않고 화면에서 계산한다 (8장 11번) */
export function pricePerMl(p: Pick<Product, "price_jpy" | "volume_ml">): number | null {
  if (p.price_jpy == null || p.volume_ml == null) return null;
  return Math.round((p.price_jpy / p.volume_ml) * 10) / 10;
}

// ── 경쟁제품 CSV 등록 (시장 분석 · 경쟁제품 탭, 2026-10-26) ─────────────

/** CSV 한 줄을 읽은 결과 (브라우저가 열을 맞춰 보낸다). Qoo10 상품만 받는다 */
export const CompetitorImportRow = z.object({
  /** Qoo10 상품코드. (workspace_id, platform_id, external_id)로 같은 제품은 한 번만 */
  external_id: z.string().regex(/^\d+$/, "상품코드는 숫자여야 해요"),
  brand: z.string().trim().min(1),
  name: z.string().trim().min(1),
  url: z.string().url().nullable(),
  price_jpy: z.number().int().positive(),
  sale_price_jpy: z.number().int().positive().nullable(),
  coupon_price_jpy: z.number().int().positive().nullable(),
  /** 상품명·용량 열에서 찾은 용량. 서로 다른 제품을 묶은 세트는 null */
  volume_ml: z.number().positive().nullable(),
  ingredients: z.array(z.string()),
  /** 핵심 유효 성분 (한국어, 수집 CSV 값) */
  key_ingredients_ko: z.string().nullable(),
  /** CSV 원본 한 줄 (DB의 source_raw로 그대로 보관) */
  raw: z.record(z.string(), z.string()),
});
export type CompetitorImportRow = z.infer<typeof CompetitorImportRow>;

export const CompetitorImportInput = z.object({
  fileName: z.string().max(200),
  category: z.string().min(1),
  /** 이 경쟁 제품들과 연결할 자사 제품 (선택). 연결하면 product_competitors에 들어간다 */
  ownProductId: z.string().uuid().nullable(),
  rows: z.array(CompetitorImportRow).min(1).max(200),
});
export type CompetitorImportInput = z.infer<typeof CompetitorImportInput>;
