// 더미 크롤링 결과(ranking-banners.json)와 그 "분석 결과" 샘플.
// 샘플 분석도 실제 호출과 같은 대조(verifyAppeal)를 거친다. 이미지는 public/mock/appeal/에 같은 문구로 그려져 있다
import { z } from "zod";
import banners from "./ranking-banners.json";
import { verifyAppeal } from "@/lib/ai/appeal-normalize";
import { PromoHookType, SkinConcern, type AppealAnalysis, type TrendSource } from "@/lib/schemas/trend";

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

export function bannerImageUrl(b: Banner): string {
  return `/mock/appeal/${b.image}.png`;
}

/** 이미지에 그려진 글자 (분석 샘플의 ocr_text) */
function bannerText(b: Banner): string {
  return [...b.hooks.map((h) => h[1]), b.brand, b.name, ...b.heroes.map((h) => h[1]), ...b.concerns.map((c) => c[1]), "全成分：水、BG、グリセリン、フェノキシエタノール ほか"].join("\n");
}

export function findBanner(source: TrendSource, brand: string, name: string): Banner | undefined {
  const list = source === "rakuten_ranking" ? rakutenBanners : qoo10Banners;
  return list.find((b) => b.brand === brand && b.name === name);
}

export function sampleAppeal(b: Banner, analyzedAt: string): AppealAnalysis {
  const verified = verifyAppeal(
    {
      ocr_text: bannerText(b),
      hero_ingredients: b.heroes.map(([name_ja, evidence_ja]) => ({ name_ja, evidence_ja })),
      skin_concerns: b.concerns.map(([code, evidence_ja]) => ({ code, evidence_ja })),
      promo_hooks: b.hooks.map(([type, text_ja]) => ({ type, text_ja })),
    },
    `${b.brand} ${b.name}`,
  );
  return { ...verified, model: "gpt-4o", prompt_version: "appeal-extract.v1", analyzed_at: analyzedAt };
}
