import { z } from "zod";
import { DateOnly, Id, Timestamp, WorkspaceRow } from "./common";

// 제안: 홈 프로젝트 진행 현황판 (P8). 프로젝트 하나 = 자사 제품 하나의 일본 진출.
// 실제 테이블(projects, project_stages)은 팀 합의 전이라 만들지 않고 가짜 데이터에서만 쓴다.

/** 업무 흐름 8단계 (prototype-plan 2장). 이 순서가 현황판의 열 순서다 */
export const StageKey = z.enum([
  "market",
  "competition",
  "appeal",
  "customer",
  "message",
  "channel",
  "promotion",
  "post_launch",
]);
export type StageKey = z.infer<typeof StageKey>;

/** 단계 상태는 사람이 직접 고른다. 다른 데이터에서 자동으로 계산하지 않는다 */
export const StageStatus = z.enum(["done", "in_progress", "blocked", "not_started"]);
export type StageStatus = z.infer<typeof StageStatus>;

export const Project = WorkspaceRow.extend({
  name: z.string(),
  /** 진출 플랫폼 */
  platform: z.string(),
  /** 제품이 products에 아직 등록되지 않았으면 null */
  product_id: Id.nullable(),
});
export type Project = z.infer<typeof Project>;

export const ProjectStage = WorkspaceRow.extend({
  project_id: Id,
  stage: StageKey,
  status: StageStatus,
  start_date: DateOnly.nullable(),
  due_date: DateOnly.nullable(),
  owner_id: Id.nullable(),
  blocker: z.string().nullable(),
  next_step: z.string().nullable(),
  log: z.array(z.object({ date: DateOnly, text: z.string() })),
  updated_at: Timestamp,
});
export type ProjectStage = z.infer<typeof ProjectStage>;
