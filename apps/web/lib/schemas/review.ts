import { z } from "zod";
import { AiMeta, BaseRow, Id, Lang, Sentiment, Timestamp, WorkspaceRow } from "./common";

export const ReviewSource = z.enum(["cosme", "rakuten", "qoo10", "oliveyoung", "csv"]);
export type ReviewSource = z.infer<typeof ReviewSource>;

// 제품 외 불만(배송 · 파손 · 누락 · 응대)이라 분석에서 뺀 사유. 마이그레이션 20261024010000. 없으면(null) 분석 대상이다
export const ExcludedReason = z.enum(["shipping", "damage", "missing_item", "service", "other_non_product"]);
export type ExcludedReason = z.infer<typeof ExcludedReason>;

export const Review = WorkspaceRow.extend({
  product_id: Id,
  source: ReviewSource,
  external_id: z.string(),
  lang: Lang,
  rating: z.number().min(0),
  body: z.string(),
  posted_at: Timestamp,
  raw: z.record(z.string(), z.unknown()).nullable(),
  // 제안: docs/prototype-plan.md 8장 7번 (body_ko), 8번 (평점 척도), 9번 (작성자 속성)
  body_ko: z.string().optional(),
  rating_scale: z.number().int().positive().optional(),
  excluded_reason: ExcludedReason.nullable().optional(),
  reviewer_attrs: z
    .object({ age_group: z.string().optional(), skin_type: z.string().optional() })
    .optional(),
});
export type Review = z.infer<typeof Review>;

// 리뷰 CSV 한 줄 (CLAUDE.md 13장 2-1: 상품명, 평점, 본문, 작성일 + 선택 열 피부타입, 연령대)
export const ReviewCsvRow = z.object({
  product_name: z.string().trim().min(1, "상품명이 비어 있어요"),
  rating: z.coerce
    .number({ error: "평점은 숫자여야 해요" })
    .int("평점은 정수여야 해요")
    .min(1, "평점은 1~5")
    .max(5, "평점은 1~5"),
  body: z.string().trim().min(1, "본문이 비어 있어요"),
  posted_date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "작성일은 YYYY-MM-DD 형식이어야 해요"),
  skin_type: z.string().trim().optional(),
  age_group: z.string().trim().optional(),
});
export type ReviewCsvRow = z.infer<typeof ReviewCsvRow>;

// 제안: 8장 6번 — 키워드를 카테고리와 함께
export const KeywordCategory = z.enum(["ingredient", "texture", "price", "scent", "skin_reaction", "other"]);
export const Keyword = z.object({ text: z.string(), category: KeywordCategory });

// 제안: 8장 19번 — 소구점 찾기. 일본어 불만과 한국어 칭찬을 같은 주제로 묶어 짝짓는다
export const AppealTopic = z.enum(["texture", "lasting_moisture", "irritation", "scent", "value", "container"]);
export type AppealTopic = z.infer<typeof AppealTopic>;
export const TopicTag = z.object({ topic: AppealTopic, polarity: z.enum(["positive", "negative"]) });
export type TopicTag = z.infer<typeof TopicTag>;

type TopicSide = { ko: string; ja: string };
/** 주제별 이름과 칭찬·불만 라벨. AI 프롬프트(prompts/)를 만들 때 같은 목록을 쓴다 */
export const APPEAL_TOPICS: Record<
  AppealTopic,
  { name: string; category: z.infer<typeof KeywordCategory>; positive: TopicSide; negative: TopicSide }
> = {
  texture: {
    name: "사용감",
    category: "texture",
    positive: { ko: "산뜻한 흡수", ja: "さっぱり" },
    negative: { ko: "끈적임", ja: "べたつき" },
  },
  lasting_moisture: {
    name: "보습 지속",
    category: "texture",
    positive: { ko: "오래가는 보습", ja: "うるおいが続く" },
    negative: { ko: "금방 건조", ja: "すぐ乾燥する" },
  },
  irritation: {
    name: "자극",
    category: "skin_reaction",
    positive: { ko: "순함", ja: "低刺激" },
    negative: { ko: "자극", ja: "刺激" },
  },
  scent: {
    name: "향",
    category: "scent",
    positive: { ko: "향 부담 없음", ja: "香りが気にならない" },
    negative: { ko: "향이 강함", ja: "香りが強い" },
  },
  value: {
    name: "가성비",
    category: "price",
    positive: { ko: "가격 대비 용량", ja: "コスパがいい" },
    negative: { ko: "가격 대비 양 부족", ja: "コスパが悪い" },
  },
  container: {
    name: "용기",
    category: "other",
    positive: { ko: "용기 편리", ja: "容器が使いやすい" },
    negative: { ko: "용기 불편", ja: "容器が使いにくい" },
  },
};

export const ReviewAnalysis = BaseRow.merge(AiMeta).extend({
  review_id: Id,
  sentiment: Sentiment,
  keywords: z.array(Keyword),
  pain_points: z.array(z.string()),
  repurchase_factors: z.array(z.string()),
  // 제안: 8장 19번
  topics: z.array(TopicTag).optional(),
});
export type ReviewAnalysis = z.infer<typeof ReviewAnalysis>;

export const ReviewInsight = WorkspaceRow.extend({
  product_id: Id,
  kind: z.enum(["pain_point", "repurchase_factor", "keyword"]),
  label: z.string(),
  count: z.number().int().nonnegative(),
  evidence_review_ids: z.array(Id),
  // 제안: 8장 7번
  label_ko: z.string().optional(),
});
export type ReviewInsight = z.infer<typeof ReviewInsight>;

// (참조 F)
export const ReviewTranslation = BaseRow.extend({
  review_id: Id,
  text_ja: z.string(),
  ad_check_id: Id.nullable(),
  status: z.enum(["draft", "approved"]),
});
export type ReviewTranslation = z.infer<typeof ReviewTranslation>;

// 리뷰 가져오기 화면에서 CSV 리뷰를 저장할 때의 입력 (lib/data/review-import-actions.ts saveReviewsFromCsv)
// origin은 화면의 "리뷰 출처"다. reviews.source에는 올리브영만 oliveyoung, 나머지(자사몰 · 기타)는 csv로 남긴다
export const ReviewImportOrigin = z.enum(["oliveyoung", "own_mall", "other"]);
export type ReviewImportOrigin = z.infer<typeof ReviewImportOrigin>;
export const ReviewImportRow = ReviewCsvRow.omit({ product_name: true }).extend({
  /** CSV의 리뷰 번호 열. 있으면 external_id로 쓰고, 없으면 서버가 내용으로 해시를 만든다 */
  review_no: z.string().trim().min(1).optional(),
  /** CSV 한 줄 원본 (열 이름 → 값) */
  raw: z.record(z.string(), z.string()),
});
export type ReviewImportRow = z.infer<typeof ReviewImportRow>;
export const ReviewImportInput = z
  .object({
    productId: Id,
    lang: Lang,
    source: ReviewSource.extract(["oliveyoung", "csv"]),
    origin: ReviewImportOrigin,
    fileName: z.string().trim().min(1).max(200),
    rows: z.array(ReviewImportRow).min(1).max(500),
  })
  .refine((v) => v.source === (v.origin === "oliveyoung" ? "oliveyoung" : "csv"), { message: "출처와 source가 맞지 않아요", path: ["source"] });
export type ReviewImportInput = z.infer<typeof ReviewImportInput>;
