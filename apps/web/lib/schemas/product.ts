import { z } from "zod";
import { PlatformId } from "../platforms";
import { Timestamp, WorkspaceRow } from "./common";

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

/** ml당 가격은 저장하지 않고 화면에서 계산한다 (8장 11번) */
export function pricePerMl(p: Pick<Product, "price_jpy" | "volume_ml">): number | null {
  if (p.price_jpy == null || p.volume_ml == null) return null;
  return Math.round((p.price_jpy / p.volume_ml) * 10) / 10;
}
