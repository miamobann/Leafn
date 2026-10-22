// 검토 이력 샘플 6건 (가상 데이터). 검토자는 공용 가짜 팀원(lib/mock/workspace.ts)의 user_id를 쓴다.
// review_status는 공용 값(pending·approved·rejected) 그대로. approved는 화면에서 "내부 검토 완료"로 표시한다.
import type { z } from "zod";
import type { AdCheck, AdUsage } from "@/lib/schemas/ad-check";

export type HistorySeed = {
  id: string;
  productId: string;
  usage: z.infer<typeof AdUsage>;
  createdAt: string;
  sampleIds: string[];
  review: Partial<Pick<AdCheck, "review_status" | "reviewer_id" | "reviewer_note" | "final_text" | "reviewed_at" | "is_expert_review_requested">>;
};

export const HISTORY_SEEDS: HistorySeed[] = [
  {
    id: "H06",
    productId: "leaf-dry-skin",
    usage: "survey_result",
    createdAt: "2026-10-22T09:15:00+09:00",
    sampleIds: ["A10", "A18"],
    review: { review_status: "pending" },
  },
  {
    id: "H05",
    productId: "leaf-combo-skin",
    usage: "notify_button",
    createdAt: "2026-10-21T15:20:00+09:00",
    sampleIds: ["A06", "A20"],
    review: {
      review_status: "pending",
      reviewer_id: "u-1",
      reviewer_note: "개인정보 동의 문구까지 설문 담당과 함께 확인",
      is_expert_review_requested: true,
    },
  },
  {
    id: "H04",
    productId: "leaf-dry-essence",
    usage: "sns",
    createdAt: "2026-10-21T11:40:00+09:00",
    sampleIds: ["A09", "A12", "A15"],
    review: {
      review_status: "pending",
      reviewer_id: "u-1",
      reviewer_note: "피부 장벽 관련 표현은 전문가 확인 후 결정",
      is_expert_review_requested: true,
    },
  },
  {
    id: "H03",
    productId: "leaf-dry-skin",
    usage: "banner",
    createdAt: "2026-10-21T10:05:00+09:00",
    sampleIds: ["A14", "A03"],
    review: { review_status: "pending" },
  },
  {
    id: "H02",
    productId: "leaf-dry-skin",
    usage: "sns",
    createdAt: "2026-10-20T16:10:00+09:00",
    sampleIds: ["A01", "A08"],
    review: {
      review_status: "approved",
      reviewer_id: "u-4",
      reviewer_note: "두 줄 모두 대체 표현으로 교체. 법적 확인 전",
      final_text:
        "보습 성분(히알루론산·글리세린) 배합으로 피부를 촉촉하게 가꿔주는 데일리 스킨\n히알루론산이 각질층까지 스며들어 촉촉함을 채워줍니다",
      reviewed_at: "2026-10-20T17:00:00+09:00",
    },
  },
  {
    id: "H01",
    productId: "leaf-dry-essence",
    usage: "detail_page",
    createdAt: "2026-10-20T14:30:00+09:00",
    sampleIds: ["A07", "A13"],
    review: {
      review_status: "rejected",
      reviewer_id: "u-1",
      reviewer_note: "효과를 단정하는 표현이 많아 문구 전체를 다시 쓰기로 함",
      reviewed_at: "2026-10-20T15:00:00+09:00",
    },
  },
];
