import { PromoEvent } from "@/lib/schemas/promo";
import { parseAll, ts, WORKSPACE_ID } from "./helpers";

// 2026-10-26 기준 프로모션 캘린더 시연용 데이터.
// 플랫폼 행사는 Qoo10만 두고(예상 일정, is_confirmed = false), 자사 캠페인(숍 오픈·Instagram·설문·X)은 platform을 비우고 확정(is_confirmed = true)으로 둔다.
export const promoEvents = parseAll(
  PromoEvent,
  [
    {
      id: "pe-1",
      platform: "qoo10",
      title: "メガ割 (예상)",
      start_date: "2026-11-20",
      end_date: "2026-12-02",
      kind: "platform_event",
      is_confirmed: false,
      milestones: [
        { label: "경쟁 화장수·에센스 메가와리 할인가 기록", due_date: "2026-11-21" },
        { label: "메가와리 전후 랭킹 변화 정리", due_date: "2026-12-03" },
      ],
    },
    {
      id: "pe-2",
      platform: "",
      title: "Qoo10 숍 오픈 · Deep Skin 출시",
      start_date: "2027-01-15",
      end_date: "2027-01-31",
      kind: "own_campaign",
      is_confirmed: true,
      milestones: [
        { label: "Qoo10 입점 심사 서류 제출", due_date: "2026-10-24", done_at: ts("2026-10-24", "16:10") },
        { label: "일본어 전성분 표기 확정", due_date: "2026-10-30" },
        { label: "상세페이지 문구 만들기", due_date: "2026-11-06" },
        { label: "상세페이지 문구 약기법 검토 · 팀장 승인", due_date: "2026-11-13" },
        { label: "상세페이지에 넣을 국내 후기 번역 · 검토", due_date: "2026-11-20" },
        { label: "Qoo10 상품 등록", due_date: "2026-12-11" },
        { label: "첫 입고", due_date: "2027-01-06" },
        { label: "오픈 쿠폰 문구 검토", due_date: "2027-01-10" },
      ],
    },
    {
      id: "pe-3",
      platform: "",
      title: "SNS 출시 예고 · Instagram",
      start_date: "2027-01-05",
      end_date: "2027-01-20",
      kind: "own_campaign",
      is_confirmed: true,
      milestones: [
        { label: "출시 예고 게시물 가이드 만들기", due_date: "2026-12-12" },
        { label: "게시 문구 · 해시태그 약기법 검토", due_date: "2026-12-18" },
        { label: "게시 크리에이터 섭외 확정", due_date: "2026-12-26" },
      ],
    },
    {
      id: "pe-4",
      platform: "",
      title: "상세페이지 피부타입 설문 공개",
      start_date: "2027-01-15",
      end_date: "2027-02-13",
      kind: "own_campaign",
      is_confirmed: true,
      milestones: [
        { label: "설문 결과 페이지의 제품 추천 문구 약기법 검토", due_date: "2026-12-04" },
        { label: "상품 등록 때 상세페이지에 설문 링크 넣기", due_date: "2026-12-11" },
        { label: "설문 공개 · 응답 들어오는지 확인", due_date: "2027-01-15" },
      ],
    },
    {
      id: "pe-5",
      platform: "qoo10",
      title: "メガ割 (예상) · Core Essence 출시",
      start_date: "2027-03-01",
      end_date: "2027-03-12",
      kind: "platform_event",
      is_confirmed: false,
      milestones: [
        { label: "경쟁 에센스 2종 리뷰 수집 요청", due_date: "2026-10-23" },
        { label: "Core Essence 소구점 확정", due_date: "2026-11-27" },
        { label: "메가와리 상세페이지 가이드 만들기 (게시물 종류: 메가와리)", due_date: "2027-02-05" },
        { label: "메가와리 참가 신청", due_date: "2027-02-12" },
        { label: "할인가 · 쿠폰 확정", due_date: "2027-02-16" },
        { label: "행사 문구 약기법 검토 · 팀장 승인", due_date: "2027-02-19" },
        { label: "물류 입고", due_date: "2027-02-22" },
      ],
    },
    {
      id: "pe-6",
      platform: "",
      title: "메가와리 예고 · X",
      start_date: "2027-02-20",
      end_date: "2027-03-01",
      kind: "own_campaign",
      is_confirmed: true,
      milestones: [
        { label: "예고 게시물 가이드 만들기", due_date: "2027-02-10" },
        { label: "게시 문구 약기법 검토", due_date: "2027-02-14" },
      ],
    },
  ].map((e) => ({
    memo: null,
    ...e,
    prep_due_date: e.milestones.filter((m) => !("done_at" in m && m.done_at))[0]?.due_date ?? e.milestones[0].due_date,
    workspace_id: WORKSPACE_ID,
    created_at: ts("2026-10-15"),
  })),
  "promoEvents",
);
