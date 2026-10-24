import { z } from "zod";
import { ProductCategory } from "./ad-check";

// 콘텐츠 제작 가이드 AI의 입력·출력 모양 (prompts/content-guide-*.v1.md).
// 출력은 OpenAI 구조화 출력으로 강제하므로 모든 칸을 필수로 두고, 비어 있을 수 있는 칸은 nullable 로 둔다 (optional·default 를 쓰지 않는다).

export const ContentChannel = z.enum(["qoo10_detail", "instagram", "x", "banner"]);
export type ContentChannel = z.infer<typeof ContentChannel>;
export const ContentPostType = z.enum(["general", "mega_sale", "season"]);

/** 강조할 방향 글자 수 (화면과 같다) */
export const DIRECTION_MAX_CHARS = 50;

/** 제작 요청 (프롬프트 2장 입력 블록의 재료). 화면이 다른 탭의 결과(소구점·검색어)를 모아 넘긴다 */
export const ContentGuideInput = z.object({
  product: z.object({
    name: z.string().min(1),
    name_ja: z.string().min(1),
    kind: z.string().min(1), // 예: 스킨(化粧水)
    category: ProductCategory.nullable(),
    launch_status: z.enum(["live", "developing"]),
    volume: z.string().min(1),
    price_jpy: z.number().int().positive().nullable(),
    ingredients_ja: z.array(z.string().min(1)).min(1),
    line_products: z.array(z.string()),
  }),
  appeals: z.object({ praised: z.array(z.string()), competitor_complaints: z.array(z.string()), candidates: z.array(z.string()) }),
  keywords: z.object({ search: z.array(z.string()), ingredients: z.array(z.string()) }),
  /** 후기 블록에 쓸 실제 한국어 리뷰 원문 (리뷰 분석 데이터에서 고른 것). 없으면 빈 배열 → 후기를 지어내지 않는다 */
  review_quotes: z.array(z.string().min(1)).max(4),
  evidence: z.array(z.string()),
  promo: z.string().nullable(),
  channel: ContentChannel,
  post_type: ContentPostType,
  season: z.string().nullable(),
  slide_count: z.number().int().min(1).max(5),
  sponsored: z.boolean(),
  direction: z.string().max(DIRECTION_MAX_CHARS),
});
export type ContentGuideInput = z.infer<typeof ContentGuideInput>;

/** ① 제목 단계 출력 */
export const GuideTitle = z.object({
  title_ja: z.string().min(1),
  title_ko: z.string().min(1),
  angle: z.string(),
  recommended: z.boolean(),
  reason: z.string(),
});
export const GuideTitlesResult = z.object({ titles: z.array(GuideTitle) });
export type GuideTitle = z.infer<typeof GuideTitle>;

/** ② 본문 단계 출력 */
export const GuideCopyOut = z.object({ text_ja: z.string(), text_ko: z.string() });
export const GuideBlockOut = z.object({
  key: z.string().min(1),
  heading: z.string(),
  options: z.array(GuideCopyOut),
  reason: z.string(),
  image: z.string().nullable(),
  needs_reviews: z.boolean(),
  needs_evidence: z.boolean(),
});
export const GuideBodyResult = z.object({
  blocks: z.array(GuideBlockOut),
  hashtags: z.object({ brand: z.array(z.string()), ingredient: z.array(z.string()), trend: z.array(z.string()) }),
  gallery: z.array(z.object({ role: z.string(), image: z.string(), rules: z.array(z.string()) })),
});
export type GuideBodyResult = z.infer<typeof GuideBodyResult>;
