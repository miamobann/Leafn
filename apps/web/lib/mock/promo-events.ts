import { PromoEvent } from "@/lib/schemas/promo";
import { parseAll, ts, WORKSPACE_ID } from "./helpers";

// 행사 패턴만 반영한 샘플 날짜. 실제 일정은 각 플랫폼 공식 공지로 확인한다.
export const promoEvents = parseAll(
  PromoEvent,
  [
    { id: "pe-1", platform: "Qoo10", title: "メガ割 (샘플)", start_date: "2026-11-20", end_date: "2026-12-02", prep_due_date: "2026-11-06", kind: "platform_event" },
    { id: "pe-2", platform: "楽天市場", title: "楽天スーパーSALE (샘플)", start_date: "2026-12-04", end_date: "2026-12-11", prep_due_date: "2026-11-20", kind: "platform_event" },
    { id: "pe-3", platform: "Amazon.co.jp", title: "대형 세일 (샘플)", start_date: "2026-11-27", end_date: "2026-12-03", prep_due_date: "2026-11-13", kind: "platform_event" },
    { id: "pe-4", platform: "Instagram", title: "신제품 런칭 캠페인", start_date: "2026-11-01", end_date: "2026-11-14", prep_due_date: "2026-10-25", kind: "own_campaign" },
  ].map((e) => ({ memo: null, ...e, workspace_id: WORKSPACE_ID, created_at: ts("2026-10-15") })),
  "promoEvents",
);
