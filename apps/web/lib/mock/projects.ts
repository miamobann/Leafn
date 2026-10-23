import { Project, ProjectStage } from "@/lib/schemas/project";
import { ownProductName } from "@/lib/own-products";
import { parseAll, ts, WORKSPACE_ID } from "./helpers";

// 프로젝트 하나 = 자사 제품 하나. 두 번째 제품(Mild Skin, 개발중)은 products에 아직 등록되지 않은 것으로 둔다.
// products에 넣으면 리뷰 분석·경쟁제품 비교 같은 다른 탭 화면에도 나타나기 때문이다.
export const projects = parseAll(
  Project,
  [
    { id: "prj-1", name: ownProductName("deep-skin"), platform: "Qoo10", product_id: "p-own-1" },
    { id: "prj-2", name: ownProductName("mild-skin"), platform: "楽天市場", product_id: null },
  ].map((p) => ({ ...p, workspace_id: WORKSPACE_ID, created_at: ts("2026-09-20") })),
  "projects",
);

const EMPTY_STAGE = { start_date: null, due_date: null, owner_id: null, blocker: null, next_step: null, log: [] };

// 프로젝트마다 8단계를 한 줄씩. "오늘"은 2026-10-21 (helpers.PROTOTYPE_TODAY)
export const projectStages = parseAll(
  ProjectStage,
  [
    {
      project_id: "prj-1",
      stage: "market",
      status: "done",
      start_date: "2026-09-22",
      due_date: "2026-09-30",
      owner_id: "u-2",
      log: [
        { date: "2026-09-26", text: "化粧水 카테고리: ツボクサ(시카) 관심 상승 확인" },
        { date: "2026-09-30", text: "AI 검색 노출 첫 측정" },
      ],
    },
    {
      project_id: "prj-1",
      stage: "competition",
      status: "done",
      start_date: "2026-10-01",
      due_date: "2026-10-08",
      owner_id: "u-2",
      log: [{ date: "2026-10-08", text: "경쟁 토너 3종 가격·용량·성분 비교 완료" }],
    },
    {
      project_id: "prj-1",
      stage: "appeal",
      status: "done",
      start_date: "2026-10-06",
      due_date: "2026-10-14",
      owner_id: "u-3",
      log: [{ date: "2026-10-14", text: "소구점 후보: 저자극 · 끈적임 없는 수분" }],
    },
    {
      project_id: "prj-1",
      stage: "customer",
      status: "done",
      start_date: "2026-10-08",
      due_date: "2026-10-16",
      owner_id: "u-3",
      log: [{ date: "2026-10-16", text: "설문 응답 120건 집계: 乾燥肌 응답이 가장 많음" }],
    },
    {
      project_id: "prj-1",
      stage: "message",
      status: "blocked",
      start_date: "2026-10-14",
      due_date: "2026-10-25",
      owner_id: "u-4",
      blocker: "「肌荒れが治りました」가 의약품적 효능 표현이라, 대체 문구 승인을 기다리는 중",
      next_step: "문구 승인",
      log: [
        { date: "2026-10-17", text: "상세페이지 문구 초안 작성" },
        { date: "2026-10-19", text: "광고 문구 1건 반려" },
      ],
    },
    {
      project_id: "prj-1",
      stage: "channel",
      status: "in_progress",
      start_date: "2026-10-15",
      due_date: "2026-10-28",
      owner_id: "u-1",
      next_step: "Qoo10 입점 서류 제출",
      log: [{ date: "2026-10-18", text: "Qoo10 메가와리 참가 조건 확인" }],
    },
    { project_id: "prj-1", stage: "promotion", status: "not_started", owner_id: "u-1" },
    { project_id: "prj-1", stage: "post_launch", status: "not_started", owner_id: "u-3" },
    {
      project_id: "prj-2",
      stage: "market",
      status: "done",
      start_date: "2026-10-01",
      due_date: "2026-10-09",
      owner_id: "u-2",
      log: [{ date: "2026-10-09", text: "クリーム 카테고리: セラミド 관심 상승" }],
    },
    {
      project_id: "prj-2",
      stage: "competition",
      status: "in_progress",
      start_date: "2026-10-10",
      due_date: "2026-10-24",
      owner_id: "u-2",
      next_step: "경쟁제품 등록",
      log: [{ date: "2026-10-15", text: "라쿠텐 크림 랭킹 상위 10개 확인" }],
    },
    {
      project_id: "prj-2",
      stage: "appeal",
      status: "in_progress",
      start_date: "2026-10-14",
      due_date: "2026-10-31",
      owner_id: "u-3",
      next_step: "국내 리뷰 가져오기",
      log: [{ date: "2026-10-20", text: "국내 리뷰 CSV 준비 중" }],
    },
    { project_id: "prj-2", stage: "customer", status: "not_started" },
    { project_id: "prj-2", stage: "message", status: "not_started" },
    { project_id: "prj-2", stage: "channel", status: "not_started" },
    { project_id: "prj-2", stage: "promotion", status: "not_started" },
    { project_id: "prj-2", stage: "post_launch", status: "not_started" },
  ].map((s) => ({
    ...EMPTY_STAGE,
    ...s,
    id: `${s.project_id}-${s.stage}`,
    workspace_id: WORKSPACE_ID,
    created_at: ts("2026-09-20"),
    updated_at: ts("2026-10-20"),
  })),
  "projectStages",
);
