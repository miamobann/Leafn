import { z } from "zod";
import { BaseRow, Id } from "./common";

export const Workspace = BaseRow.extend({
  name: z.string(),
  // 제안: docs/prototype-plan.md 8장 (초대 코드는 가짜)
  invite_code: z.string().optional(),
});
export type Workspace = z.infer<typeof Workspace>;

export const WorkspaceMember = BaseRow.extend({
  workspace_id: Id,
  user_id: Id,
  role: z.enum(["owner", "member"]),
  // 제안: docs/prototype-plan.md 8장 16번
  display_name: z.string().optional(),
  title: z.string().optional(),
});
export type WorkspaceMember = z.infer<typeof WorkspaceMember>;

// profiles 테이블 (supabase/migrations/202610221720_base_workspaces.sql)
export const Profile = BaseRow.extend({
  display_name: z.string().nullable(),
  title: z.string().nullable(),
});
export type Profile = z.infer<typeof Profile>;
