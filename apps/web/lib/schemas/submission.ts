import { z } from "zod";
import { AdAction } from "./ad-check";
import { Id, Risk, Timestamp, WorkspaceRow } from "./common";
import { AppealTopic } from "./review";

// 탭별 시안 · 버전 · 팀장 결재 (docs/team-approval-ai-analysis.md 4~6장).
// 테이블: supabase/migrations/20261025115007_team_approval.sql (member_tabs, tab_submissions, submission_versions, submission_reviews)

/** 시안을 올리는 탭. 담당 탭 권한(member_tabs)도 이 값으로 준다 */
export const SubmissionTab = z.enum(["market", "review", "ad"]);
export type SubmissionTab = z.infer<typeof SubmissionTab>;

export const SUBMISSION_TAB_LABELS: Record<SubmissionTab, string> = {
  market: "시장 분석",
  review: "리뷰 분석",
  ad: "광고 검토",
};

/** 시안 상태. 버전 상태로 DB 함수가 다시 계산한다 (in_review = 결재 대기 버전 있음) */
export const SubmissionStatus = z.enum(["draft", "in_review", "approved", "rejected"]);
export type SubmissionStatus = z.infer<typeof SubmissionStatus>;

export const VersionStatus = z.enum(["draft", "submitted", "approved", "rejected", "withdrawn"]);
export type VersionStatus = z.infer<typeof VersionStatus>;

export const Decision = z.enum(["approved", "rejected"]);
export type Decision = z.infer<typeof Decision>;

export const MemberTab = WorkspaceRow.extend({
  user_id: Id,
  tab: SubmissionTab,
  granted_by: Id.nullable(),
});
export type MemberTab = z.infer<typeof MemberTab>;

export const TabSubmission = WorkspaceRow.extend({
  updated_at: Timestamp,
  project_id: Id,
  /** 비어 있으면 프로젝트 전체 시안 (시장 분석만) */
  product_id: Id.nullable(),
  tab: SubmissionTab,
  title: z.string().min(1),
  owner_id: Id.nullable(),
  approved_version_id: Id.nullable(),
  status: SubmissionStatus,
  deleted_at: Timestamp.nullable(),
});
export type TabSubmission = z.infer<typeof TabSubmission>;

/** 버전의 근거 한 건. 배열이라 DB가 FK를 확인하지 않으므로 넣는 코드가 실제로 있는 행만 넣는다 (DB_RULES 4.2) */
export const EvidenceRef = z.object({
  kind: z.enum(["review", "product", "ad_check", "trend_snapshot"]),
  id: Id,
});
export type EvidenceRef = z.infer<typeof EvidenceRef>;

// 탭별 결과 스냅샷 (submission_versions.body). AI 분석은 이 모양만 읽는다 (설계 5장)

/** 리뷰 분석 집계의 한 줄 (불만 · 재구매 요인 · 키워드). 근거 리뷰 ID를 남긴다 */
const ReviewBodyItem = z.object({
  label: z.string().min(1),
  count: z.number().int().nonnegative(),
  evidence_review_ids: z.array(Id),
});

/** 리뷰 리포트의 주제별 성적표 한 줄 (reviews/_lib/topics.ts의 topicStats · verdictOf를 그대로 저장) */
const ReviewBodyTopic = z.object({
  topic: AppealTopic,
  positive: z.number().int().nonnegative(),
  negative: z.number().int().nonnegative(),
  verdict: z.enum(["strength", "weakness", "unclear"]),
  evidence_review_ids: z.array(Id),
});

/** 소구점 찾기에서 시안에 담은 소구점 (경쟁 불만 → 자사 칭찬). 주제는 같은 시안의 성적표(topics)에도 있는 강점 주제다 */
const ReviewBodyAppeal = z.object({
  topic: AppealTopic,
  own_praises: z.number().int().nonnegative(),
  competitor_complaints: z.number().int().nonnegative(),
  evidence_review_ids: z.array(Id),
});

/** 상세페이지용 리뷰에서 시안에 담은 일본어 후기. 시안이 승인되면 콘텐츠 제작 가이드가 이 문구를 인용한다 */
const ReviewBodyTranslation = z.object({
  review_translation_id: Id,
  review_id: Id,
  ad_check_id: Id.nullable(),
  text_ja: z.string().min(1),
  text_ko: z.string(),
  /** 약기법 검토의 대체 표현으로 고친 문장이면 true */
  edited: z.boolean(),
});

export const ReviewBody = z.object({
  product_id: Id,
  review_count: z.number().int().nonnegative(),
  analyzed_count: z.number().int().nonnegative(),
  sentiment: z.object({
    positive: z.number().int().nonnegative(),
    negative: z.number().int().nonnegative(),
    neutral: z.number().int().nonnegative(),
  }),
  topics: z.array(ReviewBodyTopic),
  pain_points: z.array(ReviewBodyItem),
  repurchase_factors: z.array(ReviewBodyItem),
  keywords: z.array(ReviewBodyItem),
  /** 이전에 저장한 시안에는 없는 칸이라 선택으로 둔다 */
  appeals: z.array(ReviewBodyAppeal).optional(),
  translations: z.array(ReviewBodyTranslation).optional(),
});
export type ReviewBody = z.infer<typeof ReviewBody>;

/** 광고 검토 시안은 기존 ad_checks를 묶는다. 승인 상태는 결재 때 ad_checks 쪽이 바뀌므로 여기 남기지 않는다 */
export const AdBody = z.object({
  items: z
    .array(
      z.object({
        ad_check_id: Id,
        /** 검토한 문구의 앞부분 */
        input_excerpt: z.string(),
        overall_risk: Risk.nullable(),
        overall_action: AdAction.nullable(),
        is_expert_review_requested: z.boolean(),
        final_text: z.string().nullable(),
      }),
    )
    .min(1),
});
export type AdBody = z.infer<typeof AdBody>;

// ── 시장 분석 요약 스냅샷 (2026-10-26). 시장 분석 요약 탭에 보이는 내용을 시안을 올리는 순간 그대로 고정한다.
// 서버가 요약 탭과 같은 계산(market/_lib/summary.ts)으로 다시 만들고, 결재 문서는 다시 계산하지 않고 이 값을 보여 준다

/** 이번 주 핵심 칸 하나 */
const MarketSummaryCore = z.object({ id: z.string(), label: z.string(), value: z.string(), meaning: z.string(), sub: z.string().nullable() });
/** 이번 분석으로 알 수 있는 것 한 줄 */
const MarketSummaryPoint = z.object({ id: z.string(), label: z.string(), headline: z.string(), action: z.string(), sample: z.boolean() });
/** 한눈에 보기 칸 하나 (그래프 대신 같은 숫자를 글로) */
const MarketSummaryTile = z.object({ key: z.string(), title: z.string(), value: z.string(), label: z.string(), lines: z.array(z.string()) });

export const MarketSummary = z.object({
  /** 고정 기준: 카테고리 · 플랫폼 · 기준 주 · 랭킹 수집일 */
  basis: z.object({
    category: z.string(),
    platform: z.string(),
    platform_label: z.string(),
    week: z.string().nullable(),
    captured_at: z.string().nullable(),
  }),
  core: z.array(MarketSummaryCore),
  points: z.array(MarketSummaryPoint),
  tiles: z.array(MarketSummaryTile),
});
export type MarketSummary = z.infer<typeof MarketSummary>;

/**
 * 시장 분석 시안. points = 판단 목록 (AI 분석이 읽는 한 줄씩), summary = 시장 분석 요약 탭 스냅샷 (2026-10-26 추가, 이전 시안에는 없어 선택 칸)
 */
export const MarketBody = z.object({
  scope: z.enum(["product", "project"]),
  points: z
    .array(
      z.object({
        text: z.string().min(1),
        evidence: z.array(EvidenceRef),
      }),
    )
    .min(1),
  summary: MarketSummary.optional(),
});
export type MarketBody = z.infer<typeof MarketBody>;

export const VERSION_BODY_BY_TAB = { market: MarketBody, review: ReviewBody, ad: AdBody } as const;

export const SubmissionVersion = WorkspaceRow.extend({
  updated_at: Timestamp,
  submission_id: Id,
  version_no: z.number().int().min(1),
  author_id: Id.nullable(),
  /** 한 줄 결론. 제출할 때는 비어 있으면 안 된다 */
  summary: z.string().max(300),
  /** 탭별 모양은 VERSION_BODY_BY_TAB로 읽는다 (탭은 시안에 있다) */
  body: z.record(z.string(), z.unknown()),
  evidence: z.array(EvidenceRef),
  data_as_of: Timestamp.nullable(),
  note: z.string().nullable(),
  status: VersionStatus,
  submitted_at: Timestamp.nullable(),
  deleted_at: Timestamp.nullable(),
});
export type SubmissionVersion = z.infer<typeof SubmissionVersion>;

export const SubmissionReview = WorkspaceRow.extend({
  version_id: Id,
  reviewer_id: Id.nullable(),
  decision: Decision,
  /** 반려면 필수 (DB check) */
  reason: z.string().nullable(),
  is_self_review: z.boolean(),
  decided_at: Timestamp,
});
export type SubmissionReview = z.infer<typeof SubmissionReview>;
