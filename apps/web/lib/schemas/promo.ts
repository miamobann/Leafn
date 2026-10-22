import { z } from "zod";
import { DateOnly, WorkspaceRow } from "./common";

// (참조 I)
export const PromoEvent = WorkspaceRow.extend({
  platform: z.string(),
  title: z.string(),
  start_date: DateOnly,
  end_date: DateOnly,
  prep_due_date: DateOnly,
  memo: z.string().nullable(),
  // 제안: docs/prototype-plan.md 8장 12번
  kind: z.enum(["platform_event", "own_campaign"]).optional(),
  milestones: z.array(z.object({ label: z.string(), due_date: DateOnly })).optional(),
});
export type PromoEvent = z.infer<typeof PromoEvent>;
