import { z } from "zod";
import { Sentiment } from "./common";
import { AppealTopic, ExcludedReason, KeywordCategory } from "./review";

// 리뷰 분석 AI 응답의 모양 (prompts/review-analysis.v1.md 의 #출력 형식과 같다).
// 리뷰 id(uuid)를 AI에게 베끼게 하지 않고, 입력한 번호 n 으로 되돌린다.
// 개수 제한(키워드 5개 등)은 구조화 출력의 제약을 피하려고 스키마가 아니라 parse.ts 에서 다듬는다.

export const AiReviewResult = z.object({
  n: z.number().int(),
  excluded_reason: ExcludedReason.nullable(),
  sentiment: Sentiment,
  topics: z.array(z.object({ topic: AppealTopic, polarity: z.enum(["positive", "negative"]) })),
  keywords: z.array(z.object({ text: z.string(), category: KeywordCategory })),
  pain_points: z.array(z.string()),
  repurchase_factors: z.array(z.string()),
});
export type AiReviewResult = z.infer<typeof AiReviewResult>;

export const AiReviewBatch = z.object({ results: z.array(AiReviewResult) });
export type AiReviewBatch = z.infer<typeof AiReviewBatch>;

// 일본어 리뷰 한국어 번역 응답 (prompts/review-translate-ko.v1.md 의 #출력 형식)
export const AiTranslationBatch = z.object({ results: z.array(z.object({ n: z.number().int(), text_ko: z.string() })) });
export type AiTranslationBatch = z.infer<typeof AiTranslationBatch>;
