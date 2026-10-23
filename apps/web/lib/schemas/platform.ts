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
  // 확정: docs/db-frame.md 2장 "진출 실행" (2026-10-23)
  memo: z.string().nullable().optional(),
});
export type PlatformNote = z.infer<typeof PlatformNote>;

/** 화면에서 고치는 칸 (플랫폼 상세) */
export const PlatformNotePatch = z.object({
  status: PlatformNote.shape.status,
  memo: z.string().max(2000).nullable(),
});
export type PlatformNotePatch = z.infer<typeof PlatformNotePatch>;
