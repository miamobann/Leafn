// 약기법 광고 검토 AI 판정의 공통 규칙. 프롬프트(prompts/ad-check.v4.md) 5장과 같은 규칙이다.
import type { AdAction } from "@/lib/schemas/ad-check";
import type { Risk } from "@/lib/schemas/common";

/** 한 요청에 담을 수 있는 최대 줄 수 */
export const MAX_LINES = 20;

/** 행동 기준 → 위험도 (위험도는 AI가 아니라 행동 기준에서 정해진다) */
export const RISK_BY_ACTION: Record<AdAction, Risk> = { must_fix: "high", should_fix: "medium", expert: "medium", ok: "low" };

const SEVERITY: Record<AdAction, number> = { must_fix: 3, should_fix: 2, expert: 1, ok: 0 };

/** 여러 행동 기준 중 가장 심한 것. 비어 있으면 ok */
export function worstAction(actions: AdAction[]): AdAction {
  return actions.reduce<AdAction>((worst, a) => (SEVERITY[a] > SEVERITY[worst] ? a : worst), "ok");
}
