import { Workspace, WorkspaceMember } from "@/lib/schemas/workspace";
import { parseAll, ts, WORKSPACE_ID } from "./helpers";

export const workspace = Workspace.parse({
  id: WORKSPACE_ID,
  created_at: ts("2026-10-01"),
  name: "샘플 브랜드 해외사업팀",
  invite_code: "SAMPLE-0000",
});

export const members = parseAll(
  WorkspaceMember,
  [
    { id: "m-1", user_id: "u-1", display_name: "김도훈", title: "해외사업팀장", role: "owner" },
    { id: "m-2", user_id: "u-2", display_name: "이서연", title: "브랜드·시장 전략", role: "member" },
    { id: "m-3", user_id: "u-3", display_name: "박지민", title: "고객 인사이트", role: "member" },
    { id: "m-4", user_id: "u-4", display_name: "최유나", title: "콘텐츠·현지화", role: "member" },
  ].map((m) => ({ ...m, workspace_id: WORKSPACE_ID, created_at: ts("2026-10-01") })),
  "members",
);
