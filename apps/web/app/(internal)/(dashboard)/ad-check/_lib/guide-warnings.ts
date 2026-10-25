// 콘텐츠 가이드 블록별 주의 문구 (금지어 검사 + 약기법 판정). 만들 때(화면)와 저장된 결과물을 다시 열 때(서버) 같이 쓴다.

/** 블록 key → 주의 문구 */
export type BlockWarnings = Record<string, string[]>;

/** 약기법 판정 행동 이름 (광고 검토와 같은 말) */
const ACTION_LABEL: Record<string, string> = { must_fix: "수정 필수", should_fix: "수정 권장", expert: "전문가 확인" };

type LintHitLike = { key: string; text: string; reason: string };
type CheckLike = { key: string; action: string; findings: { text: string }[] };

export function buildWarnings(lintHits: LintHitLike[], checks: CheckLike[]): BlockWarnings {
  const out: BlockWarnings = {};
  const add = (key: string, text: string) => (out[key] = [...(out[key] ?? []), text]);
  for (const h of lintHits) add(h.key, `「${h.text}」 ${h.reason}`);
  for (const c of checks) {
    if (c.action !== "ok") add(c.key, `약기법 판정 ${ACTION_LABEL[c.action] ?? c.action}${c.findings.length ? `: ${c.findings.map((f) => f.text).join(", ")}` : ""}`);
  }
  return out;
}
