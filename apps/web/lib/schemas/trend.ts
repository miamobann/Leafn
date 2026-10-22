import { z } from "zod";
import { Timestamp, WorkspaceRow } from "./common";

// 제안: docs/prototype-plan.md 8장 10번 — data jsonb의 모양
export const RankingItem = z.object({
  rank: z.number().int().positive(),
  name: z.string(),
  brand: z.string(),
  price_jpy: z.number().int().nonnegative(),
  review_count: z.number().int().nonnegative(),
  is_kbeauty: z.boolean(),
});

export const IngredientCount = z.object({ ingredient: z.string(), count: z.number().int().nonnegative() });

export const TrendSnapshot = WorkspaceRow.extend({
  source: z.enum(["rakuten_ranking"]),
  category: z.string(),
  captured_at: Timestamp,
  data: z.object({
    ranking: z.array(RankingItem),
    ingredients: z.array(IngredientCount),
  }),
});
export type TrendSnapshot = z.infer<typeof TrendSnapshot>;
