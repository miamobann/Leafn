// 광고 검토 전용 배지. 공용 badges.tsx는 고치지 않고 탭 안에서 만든다.
// 색은 globals.css 토큰만 쓰고, 색만으로 구분하지 않도록 기호·글자를 함께 쓴다.
import type { z } from "zod";
import { Badge } from "@/components/ui/badge";
import type { AdAction, AdUsage } from "@/lib/schemas/ad-check";
import type { ReviewStatus } from "@/lib/schemas/common";

export const ACTION_TONE = {
  must_fix: { label: "✕ 수정 필수", badge: "bg-risk-high/15 text-risk-high", mark: "bg-risk-high/15 decoration-risk-high" },
  should_fix: { label: "! 수정 권장", badge: "bg-risk-medium/15 text-risk-medium", mark: "bg-risk-medium/15 decoration-risk-medium" },
  expert: {
    label: "? 전문가 확인",
    badge: "bg-sentiment-positive/15 text-sentiment-positive",
    mark: "bg-sentiment-positive/15 decoration-sentiment-positive",
  },
  ok: { label: "✓ 문제 없음", badge: "bg-risk-low/15 text-risk-low", mark: "" },
} satisfies Record<AdAction, { label: string; badge: string; mark: string }>;

// approved는 법적 승인으로 오해되지 않도록 "내부 검토 완료"로 표시한다
const STATUS_TONE = {
  pending: { label: "… 검토 중", className: "bg-status-pending/15 text-status-pending" },
  approved: { label: "✓ 내부 검토 완료", className: "bg-status-approved/15 text-status-approved" },
  rejected: { label: "✕ 반려", className: "bg-status-rejected/15 text-status-rejected" },
} satisfies Record<ReviewStatus, { label: string; className: string }>;

export const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: STATUS_TONE.pending.label,
  approved: STATUS_TONE.approved.label,
  rejected: STATUS_TONE.rejected.label,
};

export const USAGE_LABEL: Record<z.infer<typeof AdUsage>, string> = {
  detail_page: "상세페이지",
  sns: "SNS",
  banner: "광고 배너",
  survey_result: "설문 결과 페이지",
  notify_button: "알림받기 버튼",
};

export function ActionBadge({ action }: { action: AdAction }) {
  return <Badge className={ACTION_TONE[action].badge}>{ACTION_TONE[action].label}</Badge>;
}

export function ReviewStateBadge({ status, expertRequested }: { status: ReviewStatus; expertRequested?: boolean | null }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      <Badge className={STATUS_TONE[status].className}>{STATUS_TONE[status].label}</Badge>
      {expertRequested && <Badge className={ACTION_TONE.expert.badge}>? 전문가 확인 요청</Badge>}
    </span>
  );
}
