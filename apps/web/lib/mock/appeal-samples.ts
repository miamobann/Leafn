// 더미 크롤링 결과(ranking-banners.json): 楽天·Qoo10 상위 상품의 프로모션 문구와 Qoo10 化粧水 랭킹.
// 상세 이미지 분석은 2026-10-24에 뺐다 (소구 성분은 크롤링 데이터로 받는다)
import { z } from "zod";
import banners from "./ranking-banners.json";
import { PromoHookType, SkinConcern, type TrendSource } from "@/lib/schemas/trend";

const Banner = z.object({
  image: z.string(),
  brand: z.string(),
  name: z.string(),
  heroes: z.array(z.tuple([z.string(), z.string()])),
  concerns: z.array(z.tuple([SkinConcern, z.string()])),
  hooks: z.array(z.tuple([PromoHookType, z.string()])),
});
const Qoo10Banner = Banner.extend({
  rank: z.number().int().positive(),
  price_jpy: z.number().int().nonnegative(),
  review_count: z.number().int().nonnegative(),
  is_kbeauty: z.boolean(),
});
export type Banner = z.infer<typeof Banner>;

export const rakutenBanners = z.array(Banner).parse(banners.rakuten);
export const qoo10Banners = z.array(Qoo10Banner).parse(banners.qoo10);

export function findBanner(source: TrendSource, brand: string, name: string): Banner | undefined {
  const list = source === "rakuten_ranking" ? rakutenBanners : qoo10Banners;
  return list.find((b) => b.brand === brand && b.name === name);
}
