import { Review } from "@/lib/schemas/review";
import { parseAll, ts, WORKSPACE_ID } from "./helpers";

// 실제 리뷰를 복사하지 않고 형식만 흉내 낸 샘플 (CLAUDE.md 0장)
const ko = [
  ["r-ko-1", 5, "순하고 촉촉해서 재구매했어요.", "지성", "20대"],
  ["r-ko-2", 4, "흡수가 빠른데 향이 조금 아쉬워요.", "복합성", "30대"],
  ["r-ko-3", 2, "제 피부엔 조금 따가웠어요.", "민감성", "20대"],
  ["r-ko-4", 5, "가격 대비 용량이 넉넉해요.", "건성", "30대"],
  ["r-ko-5", 4, "트러블 진정에 도움이 됐어요.", "지성", "10대"],
] as const;

const ja = [
  ["r-ja-1", "p-comp-1", 5, "さっぱりしていて毎日使いやすい。", "毎日 쓰기 편하고 산뜻해요.", "脂性肌", "20代"],
  ["r-ja-2", "p-comp-1", 3, "少しべたつきが残るのが気になる。", "끈적임이 조금 남는 게 신경 쓰여요.", "混合肌", "30代"],
  ["r-ja-3", "p-comp-2", 4, "保湿力は十分。容量がもう少し欲しい。", "보습력은 충분. 용량이 조금 더 있으면.", "乾燥肌", "40代"],
  ["r-ja-4", "p-comp-2", 2, "香りが強くて合わなかった。", "향이 강해서 안 맞았어요.", "敏感肌", "30代"],
  ["r-ja-5", "p-comp-1", 4, "価格が手頃でリピートしています。", "가격이 적당해서 재구매 중이에요.", "普通肌", "20代"],
] as const;

export const reviews = parseAll(
  Review,
  [
    ...ko.map(([id, rating, body, skin, age], i) => ({
      id,
      product_id: "p-own-1",
      source: "oliveyoung",
      external_id: `oy-${i + 1}`,
      lang: "ko",
      rating,
      rating_scale: 5,
      body,
      posted_at: ts(`2026-10-0${i + 1}`),
      reviewer_attrs: { skin_type: skin, age_group: age },
    })),
    ...ja.map(([id, productId, rating, body, bodyKo, skin, age], i) => ({
      id,
      product_id: productId,
      source: "rakuten",
      external_id: `rk-${i + 1}`,
      lang: "ja",
      rating,
      rating_scale: 5,
      body,
      body_ko: bodyKo,
      posted_at: ts(`2026-10-1${i}`),
      reviewer_attrs: { skin_type: skin, age_group: age },
    })),
  ].map((r) => ({ raw: null, ...r, workspace_id: WORKSPACE_ID, created_at: r.posted_at })),
  "reviews",
);
