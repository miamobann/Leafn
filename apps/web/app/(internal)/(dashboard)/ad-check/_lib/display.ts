// 행동 기준·검토 상태의 이름, 아이콘, 색을 한곳에 모은다.
// 색 토큰(globals.css)은 공용 파일이라 탭 작업 범위 밖이다. 토큰이 생기면 이 파일의 클래스만 바꾼다.
// 색만으로 구분하지 않도록 항상 아이콘과 글자를 함께 쓴다 (docs/CODING_RULES.md 6장).
import type { Action, ReviewStatus } from "./types";

type Tone = { label: string; icon: string; badge: string; mark: string };

export const ACTION_DISPLAY: Record<Action, Tone> = {
  must_fix: {
    label: "수정 필수",
    icon: "✕",
    badge: "border-red-300 bg-red-50 text-red-800",
    mark: "bg-red-100 decoration-red-600",
  },
  should_fix: {
    label: "수정 권장",
    icon: "!",
    badge: "border-amber-300 bg-amber-50 text-amber-800",
    mark: "bg-amber-100 decoration-amber-600",
  },
  expert: {
    label: "전문가 확인",
    icon: "?",
    badge: "border-sky-300 bg-sky-50 text-sky-800",
    mark: "bg-sky-100 decoration-sky-600",
  },
  ok: {
    label: "문제 없음",
    icon: "✓",
    badge: "border-emerald-300 bg-emerald-50 text-emerald-800",
    mark: "",
  },
};

export const STATUS_DISPLAY: Record<ReviewStatus, Omit<Tone, "mark">> = {
  pending: { label: "검토 중", icon: "…", badge: "border-border bg-sidebar text-muted" },
  internal_done: { label: "내부 검토 완료", icon: "✓", badge: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  rejected: { label: "반려", icon: "✕", badge: "border-red-300 bg-red-50 text-red-800" },
  expert_requested: { label: "전문가 확인 요청", icon: "?", badge: "border-sky-300 bg-sky-50 text-sky-800" },
};

export const DISCLAIMER =
  "법률 자문이 아닌 검토 보조 결과이며 최종 판단은 담당자·전문가가 합니다. '내부 검토 완료'는 법적 승인이 아닙니다.";

export const SAMPLE_NOTICE = "샘플 판정 · AI 미연결 · 저장되지 않음";
