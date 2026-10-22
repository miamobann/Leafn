import { z } from "zod";
import { Id, WorkspaceRow } from "./common";

// (참조 H)
export const PlatformNote = WorkspaceRow.extend({
  platform: z.string(),
  strengths: z.string(),
  audience: z.string(),
  fees_note: z.string().nullable(),
  updated_by: Id,
  // 제안: docs/prototype-plan.md 8장 13번
  channel_type: z.enum(["ec", "review_sns", "offline"]).optional(),
  status: z.enum(["reviewing", "preparing", "live"]).optional(),
});
export type PlatformNote = z.infer<typeof PlatformNote>;
