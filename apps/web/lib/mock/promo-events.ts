import { PromoEvent } from "@/lib/schemas/promo";
import { parseAll, ts, WORKSPACE_ID } from "./helpers";

// 행사 패턴만 반영한 샘플 날짜. 실제 일정은 각 플랫폼 공식 공지로 확인한다.
// prep_due_date는 홈 화면이 아직 읽어서 남겨 둔다 (= 가장 이른 마감)
// is_confirmed: 자사 캠페인은 확정, 플랫폼 행사는 공지를 확인한 pe-1만 확정이고 나머지는 지난 패턴으로 넣은 예상 일정
export const promoEvents = parseAll(
  PromoEvent,
  [
    { id: "pe-4", platform: "Instagram", title: "신제품 런칭 캠페인", start_date: "2026-11-01", end_date: "2026-11-14", kind: "own_campaign",
      milestones: [{ label: "크리에이티브 확정", due_date: "2026-10-25" }, { label: "게시 문구 승인", due_date: "2026-10-28" }] },
    { id: "pe-1", platform: "Qoo10", title: "メガ割 (샘플)", start_date: "2026-11-20", end_date: "2026-12-02", kind: "platform_event", is_confirmed: true,
      milestones: [{ label: "참가 신청", due_date: "2026-11-06" }, { label: "행사 문구 승인", due_date: "2026-11-10" }, { label: "물류 입고", due_date: "2026-11-13" }] },
    { id: "pe-3", platform: "Amazon.co.jp", title: "대형 세일 (샘플)", start_date: "2026-11-27", end_date: "2026-12-03", kind: "platform_event",
      milestones: [{ label: "딜 신청", due_date: "2026-11-13" }] },
    { id: "pe-2", platform: "楽天市場", title: "楽天スーパーSALE (샘플)", start_date: "2026-12-04", end_date: "2026-12-11", kind: "platform_event",
      milestones: [{ label: "쿠폰 설정", due_date: "2026-11-20" }, { label: "행사 문구 승인", due_date: "2026-11-25" }] },
    { id: "pe-5", platform: "Yahoo!ショッピング", title: "超PayPay祭 (샘플)", start_date: "2026-12-12", end_date: "2026-12-14", kind: "platform_event",
      milestones: [{ label: "참가 검토", due_date: "2026-11-28" }] },
    { id: "pe-6", platform: "@cosme SHOPPING", title: "@cosme 연말 기획 (샘플)", start_date: "2026-12-18", end_date: "2026-12-25", kind: "platform_event",
      milestones: [{ label: "기획 제안", due_date: "2026-12-01" }] },
    { id: "pe-7", platform: "LINE", title: "새해 쿠폰 발송", start_date: "2027-01-02", end_date: "2027-01-07", kind: "own_campaign",
      milestones: [{ label: "쿠폰 문구 승인", due_date: "2026-12-20" }] },
    { id: "pe-8", platform: "Qoo10", title: "新春 セール (샘플)", start_date: "2027-01-05", end_date: "2027-01-12", kind: "platform_event",
      milestones: [{ label: "참가 신청", due_date: "2026-12-22" }] },
    { id: "pe-9", platform: "TikTok", title: "크리에이터 시딩", start_date: "2027-01-20", end_date: "2027-02-10", kind: "own_campaign",
      milestones: [{ label: "크리에이터 선정", due_date: "2027-01-08" }, { label: "가이드 문구 승인", due_date: "2027-01-13" }] },
    { id: "pe-10", platform: "楽天市場", title: "お買い物マラソン (샘플)", start_date: "2027-02-04", end_date: "2027-02-10", kind: "platform_event",
      milestones: [{ label: "쿠폰 설정", due_date: "2027-01-25" }] },
    { id: "pe-11", platform: "Qoo10", title: "メガ割 (샘플)", start_date: "2027-03-01", end_date: "2027-03-12", kind: "platform_event",
      milestones: [{ label: "참가 신청", due_date: "2027-02-14" }, { label: "물류 입고", due_date: "2027-02-21" }] },
    { id: "pe-12", platform: "Amazon.co.jp", title: "新生活セール (샘플)", start_date: "2027-03-20", end_date: "2027-03-26", kind: "platform_event",
      milestones: [{ label: "딜 신청", due_date: "2027-03-02" }] },
  ].map((e) => ({ memo: null, prep_due_date: e.milestones[0].due_date, is_confirmed: e.kind === "own_campaign", ...e, workspace_id: WORKSPACE_ID, created_at: ts("2026-10-15") })),
  "promoEvents",
);
