// 시안 · 버전 상태 배지 (docs/team-approval-ai-analysis.md 3·6장). 색만으로 구분하지 않고 기호 · 글자를 함께 쓴다 (badges.tsx와 같은 규칙)
import { Badge } from "@/components/ui/badge";
import type { SubmissionStatus, VersionStatus } from "@/lib/schemas/submission";

const SUBMISSION = {
  draft: { label: "○ 작성 중", className: "bg-muted text-muted-foreground" },
  in_review: { label: "… 결재 대기", className: "bg-status-pending/15 text-status-pending" },
  approved: { label: "✓ 승인본 있음", className: "bg-status-approved/15 text-status-approved" },
  rejected: { label: "✕ 반려", className: "bg-status-rejected/15 text-status-rejected" },
} satisfies Record<SubmissionStatus, { label: string; className: string }>;

const VERSION = {
  draft: { label: "○ 임시", className: "bg-muted text-muted-foreground" },
  submitted: { label: "… 결재 대기", className: "bg-status-pending/15 text-status-pending" },
  approved: { label: "✓ 승인", className: "bg-status-approved/15 text-status-approved" },
  rejected: { label: "✕ 반려", className: "bg-status-rejected/15 text-status-rejected" },
  withdrawn: { label: "↩ 제출 취소", className: "bg-muted text-muted-foreground" },
} satisfies Record<VersionStatus, { label: string; className: string }>;

export function SubmissionStatusBadge({ status }: { status: SubmissionStatus }) {
  return <Badge className={SUBMISSION[status].className}>{SUBMISSION[status].label}</Badge>;
}

export function VersionStatusBadge({ status }: { status: VersionStatus }) {
  return <Badge className={VERSION[status].className}>{VERSION[status].label}</Badge>;
}

/** 팀장 확인 전 AI 결과 라벨 (설계 8장 보완 8) */
export function AiCheckBadge({ checked }: { checked: boolean }) {
  return checked ? (
    <Badge className="bg-status-approved/15 text-status-approved">✓ 팀장 확인</Badge>
  ) : (
    <Badge className="bg-status-pending/15 text-status-pending">AI 결과 · 팀장 확인 전</Badge>
  );
}
