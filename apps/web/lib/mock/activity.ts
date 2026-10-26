import { Activity } from "@/lib/schemas/activity";
import { parseAll, ts, WORKSPACE_ID } from "./helpers";

export const activity = parseAll(
  Activity,
  [
    { id: "act-1", actor_id: "u-4", action: "Instagram 예고 문구 검토를 요청했어요", target_type: "ad_check", target_id: "ac-p2", created_at: ts("2026-10-25", "17:40") },
    { id: "act-2", actor_id: "u-1", action: "Qoo10 입점 심사 서류를 제출했어요", target_type: "promo_event", target_id: "pe-2", created_at: ts("2026-10-24", "16:10") },
    { id: "act-3", actor_id: "u-4", action: "상세페이지 문구 검토를 요청했어요 (Deep Skin)", target_type: "ad_check", target_id: "ac-p1", created_at: ts("2026-10-24", "11:30") },
    { id: "act-4", actor_id: "u-3", action: "Deep Skin 소구점을 확정했어요", target_type: "review_report", target_id: "p-own-1", created_at: ts("2026-10-23", "18:00") },
    { id: "act-5", actor_id: "u-2", action: "경쟁 에센스를 2개로 좁혔어요", target_type: "product", target_id: "p-own-2", created_at: ts("2026-10-22", "10:20") },
  ].map((a) => ({ ...a, workspace_id: WORKSPACE_ID })),
  "activity",
);
