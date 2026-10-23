import { z } from "zod";
import { PlatformId } from "../platforms";
import { WorkspaceRow } from "./common";

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

/** ml당 가격은 저장하지 않고 화면에서 계산한다 (8장 11번) */
export function pricePerMl(p: Pick<Product, "price_jpy" | "volume_ml">): number | null {
  if (p.price_jpy == null || p.volume_ml == null) return null;
  return Math.round((p.price_jpy / p.volume_ml) * 10) / 10;
}
