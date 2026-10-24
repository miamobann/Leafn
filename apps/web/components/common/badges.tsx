import { Badge } from "@/components/ui/badge";
import type { Lang, ReviewStatus, Risk, Sentiment } from "@/lib/schemas/common";

// 색만으로 구분하지 않고 기호·글자를 함께 쓴다 (prototype-plan 4.2)
const RISK = {
  high: { label: "▲ 높음", className: "bg-risk-high/15 text-risk-high" },
  medium: { label: "● 중간", className: "bg-risk-medium/15 text-risk-medium" },
  low: { label: "▽ 낮음", className: "bg-risk-low/15 text-risk-low" },
} satisfies Record<Risk, { label: string; className: string }>;

const SENTIMENT = {
  positive: { label: "+ 긍정", className: "bg-sentiment-positive/15 text-sentiment-positive" },
  negative: { label: "− 부정", className: "bg-sentiment-negative/15 text-sentiment-negative" },
  neutral: { label: "○ 중립", className: "bg-sentiment-neutral/15 text-sentiment-neutral" },
} satisfies Record<Sentiment, { label: string; className: string }>;

const STATUS = {
  pending: { label: "… 대기", className: "bg-status-pending/15 text-status-pending" },
  approved: { label: "✓ 승인", className: "bg-status-approved/15 text-status-approved" },
  rejected: { label: "✕ 반려", className: "bg-status-rejected/15 text-status-rejected" },
} satisfies Record<ReviewStatus, { label: string; className: string }>;

export function RiskBadge({ risk }: { risk: Risk }) {
  return <Badge className={RISK[risk].className}>{RISK[risk].label}</Badge>;
}

export function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  return <Badge className={SENTIMENT[sentiment].className}>{SENTIMENT[sentiment].label}</Badge>;
}

export function StatusBadge({ status }: { status: ReviewStatus }) {
  return <Badge className={STATUS[status].className}>{STATUS[status].label}</Badge>;
}

export function LangBadge({ lang }: { lang: Lang }) {
  return <Badge variant="outline">{lang === "ko" ? "KO 한국어" : "JA 일본어"}</Badge>;
}

export function SourceBadge({ source }: { source: string }) {
  return <Badge variant="secondary">{source}</Badge>;
}

/** 샘플 데이터 영역 표시 (prototype-plan 4.2) */
export function SampleDataBadge() {
  return <Badge variant="outline">샘플</Badge>;
}

/** 기획안 기능 ID (A, B…). 테스트·리뷰 때 추적용, 정식 출시 전 제거 (prototype-plan 4.2) */
export function FeatureTag({ id }: { id: string }) {
  return <span className="rounded border border-border px-1.5 text-xs text-muted-foreground">{id}</span>;
}
