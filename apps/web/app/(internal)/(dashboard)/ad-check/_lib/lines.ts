// 입력·결과 줄을 세는 화면용 도우미. 줄 나누기와 판정은 서버(/api/ad-check, lib/ai/ad-check)가 한다.
import type { AdAction, AdLineResult } from "@/lib/schemas/ad-check";

export { MAX_LINES } from "@/lib/ai/ad-check/action";

export function countLines(text: string): number {
  return text.split("\n").filter((line) => line.trim().length > 0).length;
}

export function countByAction(lines: AdLineResult[]): Record<AdAction, number> {
  const counts: Record<AdAction, number> = { must_fix: 0, should_fix: 0, expert: 0, ok: 0 };
  for (const line of lines) counts[line.action] += 1;
  return counts;
}
