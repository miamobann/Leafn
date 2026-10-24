import { z } from "zod";
import { AiMeta, Timestamp, WorkspaceRow } from "./common";

/** 랭킹 출처. 楽天과 Qoo10은 같은 제품이어도 합치지 않고 출처별 스냅샷으로 따로 둔다 */
export const TrendSource = z.enum(["rakuten_ranking", "qoo10_ranking"]);
export type TrendSource = z.infer<typeof TrendSource>;

// 제안: 랭킹 상품의 썸네일·상세 이미지에서 뽑은 소구 포인트 (B 확장)
// 기제·보존제가 아니라 마케팅 전면에 내세운 성분, 피부 고민, 프로모션 문구만 담는다
export const SkinConcern = z.enum(["pores", "acne", "dryness", "sensitivity", "dullness", "aging", "redness", "oiliness", "other"]);
export type SkinConcern = z.infer<typeof SkinConcern>;

export const PromoHookType = z.enum(["bundle", "discount", "limited", "gift", "award", "other"]);
export type PromoHookType = z.infer<typeof PromoHookType>;

/**
 * AI 응답 모양 (JSON 스키마로 고정, prompts/appeal-extract.v1.md).
 * ocr_text를 먼저 받고, 각 항목의 근거 문구가 ocr_text·크롤링 텍스트에 그대로 있는지 서버에서 대조한다.
 * 성분 이름 통일(canonical)은 AI에게 맡기지 않고 lib/ai/appeal-normalize.ts의 사전으로 한다.
 */
export const AppealAiOutput = z.object({
  ocr_text: z.string(),
  hero_ingredients: z.array(z.object({ name_ja: z.string(), evidence_ja: z.string() })),
  skin_concerns: z.array(z.object({ code: SkinConcern, evidence_ja: z.string() })),
  promo_hooks: z.array(z.object({ type: PromoHookType, text_ja: z.string() })),
});
export type AppealAiOutput = z.infer<typeof AppealAiOutput>;

/** 저장 모양: 대조를 통과한 항목 + model, prompt_version (CLAUDE.md 5장 규칙) */
export const AppealAnalysis = z
  .object({
    ocr_text: z.string(),
    hero_ingredients: z.array(z.object({ name_ja: z.string(), canonical: z.string(), evidence_ja: z.string() })).max(5),
    skin_concerns: z.array(z.object({ code: SkinConcern, evidence_ja: z.string() })),
    promo_hooks: z.array(z.object({ type: PromoHookType, text_ja: z.string() })),
    /** 근거 문구가 원문에 없어 버린 항목 수 (할루시네이션 의심) */
    rejected_count: z.number().int().nonnegative(),
    analyzed_at: Timestamp,
  })
  .extend(AiMeta.shape);
export type AppealAnalysis = z.infer<typeof AppealAnalysis>;

// 제안: docs/prototype-plan.md 8장 10번 — data jsonb의 모양
export const RankingItem = z.object({
  rank: z.number().int().positive(),
  name: z.string(),
  brand: z.string(),
  price_jpy: z.number().int().nonnegative(),
  review_count: z.number().int().nonnegative(),
  is_kbeauty: z.boolean(),
  // 제안: 상위 상품만 분석한다 (분석 전이면 없음)
  appeal: AppealAnalysis.optional(),
  // 제안: 시장 분석 원페이지(상위권 진입 조건). data jsonb 안의 값이라 컬럼 추가는 없다
  // price_jpy는 평시가(税込) 기준 (8장 11번). 행사 주간 여부는 promo_events와 대조해 화면에서 계산한다
  /** products에 같은 제품이 있으면 그 ID (제품 상세·비교로 이어진다) */
  product_id: z.string().nullable().optional(),
  /** 상품명 한국어 해석 */
  name_ko: z.string().optional(),
  /** 상품 설명 원문. 핵심 성분·소구 태그·사용감은 저장하지 않고 이 글과 상품명을 사전에 대조해 계산한다 */
  description_ja: z.string().optional(),
  volume_ml: z.number().positive().nullable().optional(),
  /** 같은 제품의 추가 용량(리필·미니어처)만. 다른 제품 증정품은 넣지 않는다 */
  extra_volume_ml: z.number().nonnegative().optional(),
  rating: z.number().nonnegative().nullable().optional(),
  rating_scale: z.number().int().positive().optional(),
  promo_type: PromoHookType.nullable().optional(),
  /** 상품 페이지의 프로모션 문구 원문 */
  promo_text: z.string().nullable().optional(),
  /** 수상·랭킹 배지 문구 원문 */
  badges: z.array(z.string()).optional(),
  // 제안: Qoo10 수집값 (팀원이 정가·할인율·할인 적용가를 보낸다). price_jpy = 정가. 할인이 없으면 null
  /** 할인율 (%) */
  discount_rate: z.number().min(0).max(100).nullable().optional(),
  /** 할인 적용가 (税込) */
  sale_price_jpy: z.number().int().nonnegative().nullable().optional(),
});
export type RankingItem = z.infer<typeof RankingItem>;

export const IngredientCount = z.object({ ingredient: z.string(), count: z.number().int().nonnegative() });

export const TrendSnapshot = WorkspaceRow.extend({
  source: TrendSource,
  category: z.string(),
  captured_at: Timestamp,
  data: z.object({
    ranking: z.array(RankingItem),
    ingredients: z.array(IngredientCount),
  }),
});
export type TrendSnapshot = z.infer<typeof TrendSnapshot>;

/**
 * 크롤러(데이터팀)가 넘겨줄 랭킹 상품 1건. 이미지 분석의 입력.
 * image_urls: https URL 또는 public/ 아래 경로("/mock/appeal/…png"). page_text: 상세페이지에서 긁은 텍스트
 */
export const RankingSourceItem = RankingItem.omit({ appeal: true }).extend({
  source: TrendSource,
  category: z.string(),
  captured_at: Timestamp,
  image_urls: z.array(z.string().min(1)).min(1),
  page_text: z.string(),
});
export type RankingSourceItem = z.infer<typeof RankingSourceItem>;

/** POST /api/trends/appeal 입력 */
export const AppealRunInput = z.object({ source: TrendSource, category: z.string().min(1) });
export type AppealRunInput = z.infer<typeof AppealRunInput>;

/** POST /api/trends/appeal 응답 (화면이 Zod로 검증해서 쓴다) */
export const AppealRunResult = z.object({
  snapshot: TrendSnapshot.pick({ source: true, category: true, captured_at: true, data: true }),
  failures: z.array(z.object({ rank: z.number().int(), name: z.string(), error: z.string() })),
  saved: z.boolean(),
  saveError: z.string().nullable(),
});
export type AppealRunResult = z.infer<typeof AppealRunResult>;
