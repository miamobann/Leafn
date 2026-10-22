import { z } from "zod";
import { Id, WorkspaceRow } from "./common";

// 제안: docs/prototype-plan.md 8장 14번 — 새 테이블 activity_log
export const Activity = WorkspaceRow.extend({
  actor_id: Id,
  action: z.string(),
  target_type: z.enum(["ad_check", "review_report", "product", "promo_event", "platform", "survey", "geo"]),
  target_id: Id,
});
export type Activity = z.infer<typeof Activity>;
