import { Activity } from "@/lib/schemas/activity";
import { parseAll, ts, WORKSPACE_ID } from "./helpers";

export const activity = parseAll(
  Activity,
  [
    { id: "act-1", actor_id: "u-4", action: "광고 문구를 승인했어요", target_type: "ad_check", target_id: "ac-2", created_at: ts("2026-10-20", "15:00") },
    { id: "act-2", actor_id: "u-1", action: "광고 문구를 반려했어요", target_type: "ad_check", target_id: "ac-3", created_at: ts("2026-10-19", "11:00") },
    { id: "act-3", actor_id: "u-3", action: "리뷰 리포트를 만들었어요", target_type: "review_report", target_id: "p-own-1", created_at: ts("2026-10-18", "17:00") },
    { id: "act-4", actor_id: "u-2", action: "경쟁제품을 등록했어요", target_type: "product", target_id: "p-comp-3", created_at: ts("2026-10-17", "10:30") },
    { id: "act-5", actor_id: "u-1", action: "행사를 추가했어요", target_type: "promo_event", target_id: "pe-1", created_at: ts("2026-10-15", "09:00") },
  ].map((a) => ({ ...a, workspace_id: WORKSPACE_ID })),
  "activity",
);
