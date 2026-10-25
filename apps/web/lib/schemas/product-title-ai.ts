import { z } from "zod";

// 제품명 정리 AI 응답의 모양 (prompts/product-title.v1.md 의 #출력 형식).
// model · prompt_version은 응답에 없고, 저장할 때 코드가 붙인다 (lib/schemas/product.ts ProductTitleAi).
export const AiProductTitle = z.object({
  n: z.number().int(),
  brand_ko: z.string().nullable(),
  name_short_ja: z.string(),
  name_ko: z.string(),
  volume: z.string().nullable(),
  key_ingredient_ja: z.string().nullable(),
  key_ingredient_ko: z.string().nullable(),
});
export type AiProductTitle = z.infer<typeof AiProductTitle>;

export const AiProductTitleBatch = z.object({ results: z.array(AiProductTitle) });
export type AiProductTitleBatch = z.infer<typeof AiProductTitleBatch>;
