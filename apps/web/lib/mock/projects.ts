import { BoardProject, Project, ProjectStage } from "@/lib/schemas/project";
import { OWN_PRODUCT_LINE, ownProductName } from "@/lib/own-products";
import { parseAll, ts, WORKSPACE_ID } from "./helpers";

// 프로젝트(제품군) 하나 = Leaf& Dew. 자사 제품(products kind=own)이 project_id로 여기에 붙는다 (lib/mock/products.ts)
export const OWN_PROJECT_ID = "pj-1";

export const projects = parseAll(
  Project,
  [
    {
      id: OWN_PROJECT_ID,
      name: OWN_PRODUCT_LINE,
      platform_id: "qoo10",
      description: "건성·지성·복합성 3라인 6종의 Qoo10 진출",
    },
  ].map((p) => ({ ...p, workspace_id: WORKSPACE_ID, created_at: ts("2026-09-20") })),
  "projects",
);

// 홈 진행 현황판의 한 줄 = 판매 중 자사 제품 하나 (Deep Skin, Core Essence 2개).
export const boardProjects = parseAll(
  BoardProject,
  [
    { id: "prj-1", name: ownProductName("deep-skin"), platform: "Qoo10", product_id: "p-own-1" },
    { id: "prj-2", name: ownProductName("core-essence"), platform: "Qoo10", product_id: "p-own-2" },
  ].map((p) => ({ ...p, workspace_id: WORKSPACE_ID, created_at: ts("2026-09-20") })),
  "boardProjects",
);

const EMPTY_STAGE = { start_date: null, due_date: null, owner_id: null, blocker: null, next_step: null, log: [] };

// 프로젝트마다 8단계를 한 줄씩. "오늘"은 2026-10-26 (helpers.PROTOTYPE_TODAY)
export const projectStages = parseAll(
  ProjectStage,
  [
    // Deep Skin · Qoo10 · 출시 2027-01-15
    {
      project_id: "prj-1",
      stage: "market",
      status: "done",
      start_date: "2026-09-28",
      due_date: "2026-10-09",
      owner_id: "u-2",
      log: [{ date: "2026-10-09", text: "Qoo10 화장수 랭킹 상위 50 정리: 3,000엔대 대용량이 많음" }],
    },
    {
      project_id: "prj-1",
      stage: "competition",
      status: "done",
      start_date: "2026-10-05",
      due_date: "2026-10-16",
      owner_id: "u-2",
      log: [{ date: "2026-10-16", text: "경쟁 화장수 3종 연결, 우리는 가격 맵 중간대" }],
    },
    {
      project_id: "prj-1",
      stage: "appeal",
      status: "done",
      start_date: "2026-10-12",
      due_date: "2026-10-23",
      owner_id: "u-3",
      log: [{ date: "2026-10-23", text: "소구점 확정: 끈적임 없는 보습 (경쟁 불만 1위 べたつき)" }],
    },
    {
      project_id: "prj-1",
      stage: "customer",
      status: "not_started",
      start_date: "2026-11-30",
      due_date: "2027-01-15",
      owner_id: "u-3",
      next_step: "설문 추천 문구 검토 (12/04, pe-4)",
    },
    {
      project_id: "prj-1",
      stage: "message",
      status: "in_progress",
      start_date: "2026-10-20",
      due_date: "2026-11-13",
      owner_id: "u-4",
      next_step: "11/06까지 상세페이지 문구 만들기",
      log: [{ date: "2026-10-24", text: "상세페이지 첫 문구 1건 검토 요청" }],
    },
    {
      project_id: "prj-1",
      stage: "channel",
      status: "done",
      start_date: "2026-10-01",
      due_date: "2026-10-10",
      owner_id: "u-1",
      log: [{ date: "2026-10-10", text: "첫 채널 Qoo10 확정 (메가와리 참여 가능)" }],
    },
    {
      project_id: "prj-1",
      stage: "promotion",
      status: "blocked",
      start_date: "2026-10-20",
      due_date: "2027-01-14",
      owner_id: "u-1",
      blocker: "Qoo10 입점 심사 회신 대기 (10/24 서류 제출)",
      log: [{ date: "2026-10-24", text: "입점 심사 서류 제출" }],
    },
    {
      project_id: "prj-1",
      stage: "post_launch",
      status: "not_started",
      start_date: "2027-01-15",
      due_date: null,
      owner_id: "u-3",
    },

    // Core Essence · Qoo10 · 출시 2027-03 메가와리
    {
      project_id: "prj-2",
      stage: "market",
      status: "done",
      start_date: "2026-10-13",
      due_date: "2026-10-20",
      owner_id: "u-2",
      log: [{ date: "2026-10-20", text: "美容液 랭킹: 비타민C · 나이아신아마이드 키워드 상승" }],
    },
    {
      project_id: "prj-2",
      stage: "competition",
      status: "in_progress",
      start_date: "2026-10-19",
      due_date: "2026-11-06",
      owner_id: "u-2",
      next_step: "경쟁 에센스 2종 리뷰 수집 요청 (10/23 지남)",
      log: [{ date: "2026-10-22", text: "경쟁 에센스 후보 5개 중 2개로 좁힘" }],
    },
    {
      project_id: "prj-2",
      stage: "appeal",
      status: "blocked",
      start_date: "2026-10-26",
      due_date: "2026-11-27",
      owner_id: "u-3",
      blocker: "경쟁 에센스 일본 리뷰가 아직 없음",
      log: [{ date: "2026-10-21", text: "국내 리뷰 100건 AI 분석 완료" }],
    },
    {
      project_id: "prj-2",
      stage: "customer",
      status: "not_started",
      start_date: "2027-02-01",
      due_date: "2027-03-01",
      owner_id: "u-3",
      next_step: "메가와리 상세페이지에도 설문 링크",
    },
    {
      project_id: "prj-2",
      stage: "message",
      status: "not_started",
      start_date: "2027-01-20",
      due_date: "2027-02-19",
      owner_id: "u-4",
    },
    {
      project_id: "prj-2",
      stage: "channel",
      status: "done",
      start_date: "2026-10-01",
      due_date: "2026-10-10",
      owner_id: "u-1",
      log: [{ date: "2026-10-10", text: "Deep Skin과 같은 Qoo10 숍으로" }],
    },
    {
      project_id: "prj-2",
      stage: "promotion",
      status: "not_started",
      start_date: "2027-02-01",
      due_date: "2027-02-28",
      owner_id: "u-1",
      next_step: "메가와리 참가 신청 (02-12)",
    },
    {
      project_id: "prj-2",
      stage: "post_launch",
      status: "not_started",
      start_date: "2027-03-01",
      due_date: null,
      owner_id: "u-3",
    },
  ].map((s) => ({
    ...EMPTY_STAGE,
    ...s,
    id: `${s.project_id}-${s.stage}`,
    workspace_id: WORKSPACE_ID,
    created_at: ts("2026-09-20"),
    updated_at: ts("2026-10-25"),
  })),
  "projectStages",
);
