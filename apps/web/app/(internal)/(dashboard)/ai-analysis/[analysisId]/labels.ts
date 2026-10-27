// AI 분석 결과 화면 · PDF 보고서가 같이 쓰는 이름표 (프롬프트 v2 · v3의 고정 값)
import type { AiConfidence, AiDataGap, AiLearningKind, AiVerdictLevel } from "@/lib/schemas/ai-analysis";
import { SUBMISSION_TAB_LABELS } from "@/lib/schemas/submission";

export const VERDICT: Record<AiVerdictLevel, { label: string; className: string }> = {
  go: {
    label: "지금 진행",
    className: "bg-status-approved/15 text-status-approved",
  },
  fix_first: {
    label: "보완 후 진행",
    className: "bg-status-pending/15 text-status-pending",
  },
  hold: {
    label: "보류",
    className: "bg-status-rejected/15 text-status-rejected",
  },
};

export const CONFIDENCE: Record<AiConfidence, string> = {
  high: "확신 높음",
  medium: "확신 보통",
  low: "확신 낮음",
};

/** 색만으로 구분하지 않게 기호를 같이 붙인다 (submission-badges.tsx와 같은 규칙) */
export const LEARNING_KIND: Record<AiLearningKind, { label: string; className: string }> = {
  agree: { label: "✓ 같은 결론", className: "text-status-approved" },
  conflict: { label: "↔ 어긋남", className: "text-status-pending" },
  opportunity: { label: "↑ 기회", className: "text-status-approved" },
  risk: { label: "! 위험", className: "text-status-rejected" },
};

export const VERDICT_ADJUSTED = "AI는 '지금 진행'을 골랐지만, 미해결 광고 위험이 있거나 승인 탭이 2개 미만이라 '보완 후 진행'으로 낮췄어요.";

/** 설문 요약(survey@ref)을 인용한 근거의 이름. 팀장 결재를 거치지 않은 자료라 그렇게 적는다 (프롬프트 v4) */
export const SURVEY_REF_LABEL = "설문 · 참고";
export const SURVEY_REFERENCE_NOTE = "결재 전 참고 데이터";

/** 할 일 마감일 "11/05 (D-9)". 오늘을 모르면 날짜만 */
export function dueText(due: string, today?: string) {
  const [, m, d] = due.split("-");
  if (!today) return `${Number(m)}/${d}`;
  const days = Math.round((Date.parse(due) - Date.parse(today)) / 86400000);
  return `${Number(m)}/${d} (${days === 0 ? "D-day" : days > 0 ? `D-${days}` : `D+${-days}`})`;
}

export const gapText = (g: AiDataGap) => (typeof g === "string" ? g : `[${SUBMISSION_TAB_LABELS[g.tab]}] ${g.text}`);
