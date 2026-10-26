import { OWN_PRODUCT_LINE, ownProductName } from "@/lib/own-products";
import { AiAnalysis } from "@/lib/schemas/ai-analysis";
import { MemberTab, SubmissionReview, SubmissionVersion, TabSubmission } from "@/lib/schemas/submission";
import { parseAll, ts, WORKSPACE_ID } from "./helpers";
import { OWN_PROJECT_ID } from "./projects";

// 탭별 시안 · 버전 · 결재 · AI 분석 샘플 (docs/team-approval-ai-analysis.md).
// 팀원 u-2(시장)·u-3(리뷰)·u-4(광고)가 담당 탭에서 올리고 팀장 u-1이 결재한 모습. 판매 중 제품(p-own-1 = deep-skin, p-own-2 = core-essence)만 쓴다.
// 제목은 실제 저장 코드(lib/data/submission-actions.ts · ai-analysis-actions.ts)와 같은 형식이고, 제품명은 lib/own-products.ts 상수만 쓴다.
// 광고 검토 근거(ac-3 반려, ac-5 승인)는 lib/mock/ad-checks.ts의 review_status와 결정을 맞췄다.

const base = (id: string, date: string, time?: string) => ({ id, workspace_id: WORKSPACE_ID, created_at: ts(date, time) });

export const memberTabs = parseAll(
  MemberTab,
  [
    { ...base("mt-1", "2026-10-02"), user_id: "u-2", tab: "market", granted_by: "u-1" },
    { ...base("mt-2", "2026-10-02"), user_id: "u-3", tab: "review", granted_by: "u-1" },
    { ...base("mt-3", "2026-10-02"), user_id: "u-4", tab: "ad", granted_by: "u-1" },
  ],
  "memberTabs",
);

export const tabSubmissions = parseAll(
  TabSubmission,
  [
    {
      ...base("sub-1", "2026-10-06"),
      updated_at: ts("2026-10-20", "15:00"),
      project_id: OWN_PROJECT_ID,
      product_id: "p-own-1",
      tab: "review",
      title: `${ownProductName("deep-skin")} 리뷰 분석`,
      owner_id: "u-3",
      approved_version_id: "ver-1-1",
      status: "in_review",
    },
    {
      ...base("sub-2", "2026-10-18", "17:00"),
      updated_at: ts("2026-10-19", "11:00"),
      project_id: OWN_PROJECT_ID,
      product_id: "p-own-1",
      tab: "ad",
      title: `${ownProductName("deep-skin")} 광고 문구`,
      owner_id: "u-4",
      approved_version_id: null,
      status: "rejected",
    },
    {
      ...base("sub-3", "2026-10-15"),
      updated_at: ts("2026-10-15"),
      project_id: OWN_PROJECT_ID,
      product_id: null,
      tab: "market",
      title: `${OWN_PRODUCT_LINE} Qoo10 시장 정리`,
      owner_id: "u-2",
      approved_version_id: null,
      status: "draft",
    },
    {
      ...base("sub-4", "2026-10-21", "11:00"),
      updated_at: ts("2026-10-21", "14:00"),
      project_id: OWN_PROJECT_ID,
      product_id: "p-own-2",
      tab: "ad",
      title: `${ownProductName("core-essence")} 광고 문구`,
      owner_id: "u-4",
      approved_version_id: "ver-4-1",
      status: "approved",
    },
  ].map((s) => ({ deleted_at: null, ...s })),
  "tabSubmissions",
);

// 주제 태그는 own-review-seeds.ts의 r-ko-1 ~ r-ko-8 태그에서 센 값 (판정 규칙은 reviews/_lib/topics.ts)
const topic = (name: string, positive: string[], negative: string[], verdict: string) => ({
  topic: name,
  positive: positive.length,
  negative: negative.length,
  verdict,
  evidence_review_ids: [...positive, ...negative],
});

const deepSkinReview = (extra: { review_count: number; analyzed_count: number; positive: number; negative: number; upToJune: boolean }) => ({
  product_id: "p-own-1",
  review_count: extra.review_count,
  analyzed_count: extra.analyzed_count,
  sentiment: { positive: extra.positive, negative: extra.negative, neutral: 0 },
  topics: extra.upToJune
    ? [
        topic("irritation", ["r-ko-1", "r-ko-5", "r-ko-6", "r-ko-8"], ["r-ko-3", "r-ko-7"], "strength"),
        topic("lasting_moisture", ["r-ko-1", "r-ko-6"], [], "unclear"),
        topic("texture", ["r-ko-2"], [], "unclear"),
        topic("scent", [], ["r-ko-2"], "weakness"),
        topic("value", ["r-ko-4"], [], "unclear"),
        topic("container", [], [], "unclear"),
      ]
    : [
        topic("irritation", ["r-ko-1", "r-ko-5"], ["r-ko-3"], "unclear"),
        topic("lasting_moisture", ["r-ko-1"], [], "unclear"),
        topic("texture", ["r-ko-2"], [], "unclear"),
        topic("scent", [], ["r-ko-2"], "weakness"),
        topic("value", ["r-ko-4"], [], "unclear"),
        topic("container", [], [], "unclear"),
      ],
  pain_points: [{ label: "따가움 · 트러블", count: 2, evidence_review_ids: ["r-ko-3", "r-ko-7"] }],
  repurchase_factors: [
    { label: "순한 사용감", count: 3, evidence_review_ids: ["r-ko-1", "r-ko-5", "r-ko-8"] },
    { label: "보습 지속", count: 2, evidence_review_ids: ["r-ko-1", "r-ko-6"] },
  ],
  keywords: [
    { label: "순함", count: 3, evidence_review_ids: ["r-ko-1", "r-ko-5", "r-ko-8"] },
    { label: "향", count: 1, evidence_review_ids: ["r-ko-2"] },
  ],
});

const reviewEvidence = ["r-ko-1", "r-ko-3", "r-ko-5", "r-ko-6", "r-ko-7", "r-ko-8"].map((id) => ({ kind: "review", id }));

export const submissionVersions = parseAll(
  SubmissionVersion,
  [
    {
      ...base("ver-1-1", "2026-10-06"),
      updated_at: ts("2026-10-08"),
      submission_id: "sub-1",
      version_no: 1,
      author_id: "u-3",
      summary: "순한 사용감과 보습 지속이 재구매 이유, 민감 피부 자극 후기가 유일한 불만",
      body: deepSkinReview({ review_count: 5, analyzed_count: 5, positive: 4, negative: 1, upToJune: false }),
      evidence: reviewEvidence,
      data_as_of: ts("2026-10-05"),
      note: "10월 첫 주 올리브영 리뷰 기준",
      status: "approved",
      submitted_at: ts("2026-10-07"),
    },
    {
      ...base("ver-1-2", "2026-10-20", "14:00"),
      updated_at: ts("2026-10-20", "15:00"),
      submission_id: "sub-1",
      version_no: 2,
      author_id: "u-3",
      summary: "6월 리뷰를 더하니 자극 불만이 2건으로 늘었다. 순함을 내세우되 패치 테스트 안내 필요",
      body: deepSkinReview({ review_count: 8, analyzed_count: 8, positive: 6, negative: 2, upToJune: true }),
      evidence: reviewEvidence,
      data_as_of: ts("2026-10-05"),
      note: null,
      status: "submitted",
      submitted_at: ts("2026-10-20", "15:00"),
    },
    {
      ...base("ver-2-1", "2026-10-18", "17:00"),
      updated_at: ts("2026-10-19", "11:00"),
      submission_id: "sub-2",
      version_no: 1,
      author_id: "u-4",
      summary: "판매 1위 · 피부 속 표현을 고친 상세페이지 첫 줄",
      body: {
        items: [
          {
            ad_check_id: "ac-3",
            input_excerpt: "일본 판매 No.1 보습 스킨",
            overall_risk: "high",
            overall_action: "must_fix",
            is_expert_review_requested: true,
            final_text: "毎日のうるおいケアに、保湿ローション\n角質層まで水分を満たします",
          },
        ],
      },
      evidence: [{ kind: "ad_check", id: "ac-3" }],
      data_as_of: ts("2026-10-18", "16:00"),
      note: null,
      status: "rejected",
      submitted_at: ts("2026-10-18", "18:00"),
    },
    {
      ...base("ver-3-1", "2026-10-15"),
      updated_at: ts("2026-10-15"),
      submission_id: "sub-3",
      version_no: 1,
      author_id: "u-2",
      summary: "",
      body: {
        scope: "project",
        points: [{ text: "Qoo10 스킨케어 상위권은 대용량 · 저자극 제품이 많다", evidence: [] }],
      },
      evidence: [],
      data_as_of: null,
      note: "작성 중",
      status: "draft",
      submitted_at: null,
    },
    {
      ...base("ver-4-1", "2026-10-21", "11:00"),
      updated_at: ts("2026-10-21", "14:00"),
      submission_id: "sub-4",
      version_no: 1,
      author_id: "u-4",
      summary: "전문의 추천 표현을 빼고 세라마이드 배합 사실만 남긴 문구",
      body: {
        items: [
          {
            ad_check_id: "ac-5",
            input_excerpt: "세라마이드 배합 에센스",
            overall_risk: "high",
            overall_action: "must_fix",
            is_expert_review_requested: false,
            final_text: "保湿成分（セラミドNP）配合エッセンス\n乾燥が気になる季節の保湿ケア",
          },
        ],
      },
      evidence: [{ kind: "ad_check", id: "ac-5" }],
      data_as_of: ts("2026-10-21", "10:30"),
      note: null,
      status: "approved",
      submitted_at: ts("2026-10-21", "11:30"),
    },
  ].map((v) => ({ deleted_at: null, ...v })),
  "submissionVersions",
);

export const submissionReviews = parseAll(
  SubmissionReview,
  [
    {
      ...base("rv-1", "2026-10-08"),
      version_id: "ver-1-1",
      reviewer_id: "u-1",
      decision: "approved",
      reason: null,
      is_self_review: false,
      decided_at: ts("2026-10-08"),
    },
    {
      ...base("rv-2", "2026-10-19", "11:00"),
      version_id: "ver-2-1",
      reviewer_id: "u-1",
      decision: "rejected",
      reason: "「角質層まで」도 침투 표현으로 읽힐 수 있어요. 전문가 확인 결과를 받은 뒤 다시 올려 주세요.",
      is_self_review: false,
      decided_at: ts("2026-10-19", "11:00"),
    },
    {
      ...base("rv-3", "2026-10-21", "14:00"),
      version_id: "ver-4-1",
      reviewer_id: "u-1",
      decision: "approved",
      reason: null,
      is_self_review: false,
      decided_at: ts("2026-10-21", "14:00"),
    },
  ],
  "submissionReviews",
);

export const aiAnalyses = parseAll(
  AiAnalysis,
  [
    {
      ...base("ai-1", "2026-10-09"),
      updated_at: ts("2026-10-09"),
      project_id: OWN_PROJECT_ID,
      product_id: "p-own-1",
      title: `${ownProductName("deep-skin")} 통합 분석`,
      input_version_ids: ["ver-1-1"],
      result: {
        summary: "순한 사용감을 앞세우되, 민감 피부 자극 후기에 대비한 안내가 먼저 필요하다.",
        sections: [
          { key: "positioning", title: "포지셔닝", points: [] },
          {
            key: "appeal",
            title: "소구점",
            points: [{ text: "순한 사용감과 보습 지속을 첫 문장에 둔다", basis: ["ver-1-1"] }],
          },
          { key: "message", title: "광고 문구", points: [] },
          {
            key: "risk",
            title: "위험",
            points: [{ text: "민감 피부 자극 후기가 있어 '저자극' 단정 표현은 피한다", basis: ["ver-1-1"] }],
          },
        ],
        conflicts: [],
        data_gaps: ["시장 분석 승인본이 없어 포지셔닝을 판단하지 못했다", "광고 검토 승인본이 없다"],
        actions: [
          { text: "시장 분석 시안을 제출한다", tab: "market", priority: 1, basis: ["ver-1-1"] },
          { text: "상세페이지 첫 줄 문구를 광고 검토에 올린다", tab: "ad", priority: 2, basis: ["ver-1-1"] },
        ],
      },
      summary: "순한 사용감을 앞세우되, 민감 피부 자극 후기에 대비한 안내가 먼저 필요하다.",
      model: "gpt-4.1-mini",
      prompt_version: "integrated-analysis.v1",
      created_by: "u-2",
      lead_checked_by: null,
      lead_checked_at: null,
      deleted_at: null,
    },
  ],
  "aiAnalyses",
);
