import { AiLine, AiResult, type JudgedLine } from "@/lib/schemas/ad-check-ai";
import { RISK_BY_ACTION, worstAction } from "./action";

/** 모델 출력 한 줄 → 공용 스키마 모양. 위반 구간의 위치는 모델이 아니라 코드가 text 로 계산한다 */
function toJudgedLine(raw: AiLine, original: string, warnings: string[]): JudgedLine {
  const findings = raw.findings.map((f) => {
    const at = original.indexOf(f.text);
    if (at < 0) warnings.push(`줄 ${raw.line_index}: 위반 구간 「${f.text}」이 원문에 없음`);
    return {
      text: f.text,
      risk: f.risk ?? RISK_BY_ACTION[f.action],
      reason: f.reason,
      basis: f.basis,
      suggestions: f.suggestions.map((s) => s.text),
      start: at >= 0 ? at : undefined,
      end: at >= 0 ? at + f.text.length : undefined,
      action: f.action,
      basis_status: f.basis_status,
      suggestion_rechecks: f.suggestions.map((s) => ({ text: s.text, text_ko: s.text_ko ?? null, recheck: s.recheck, recheck_reason: s.recheck_reason })),
    };
  });
  return {
    action: raw.action,
    ingredient_check: raw.ingredient_check ?? "",
    translated_text: raw.translated_text ?? null,
    back_translation_ko: raw.back_translation_ko ?? null,
    localized_note: raw.localized_note ?? "",
    findings,
  };
}

export type ParsedOutput = {
  /** 입력한 줄 순서 그대로 */
  lines: JudgedLine[];
  /** 판정은 쓸 수 있지만 사람이 알아야 할 점 (위치를 못 찾음, 전체 판정 불일치) */
  warnings: string[];
};

/**
 * 모델이 낸 JSON 문자열을 검증해 줄 순서대로 바꾼다.
 * JSON이 아니거나, 모양이 틀리거나, 줄이 빠지면 Error 를 던진다 (재시도는 부르는 쪽이 한다. CLAUDE.md 7장 1번).
 */
export function parseModelOutput(text: string, lines: string[]): ParsedOutput {
  const raw = AiResult.parse(JSON.parse(text));
  const byIndex = new Map(raw.lines.map((l) => [l.line_index, l]));
  const warnings: string[] = [];

  const judged = lines.map((original, i) => {
    const found = byIndex.get(i + 1);
    if (!found) throw new Error(`줄 ${i + 1} 판정이 빠짐`);
    return toJudgedLine(found, original, warnings);
  });

  const overall = worstAction(judged.map((l) => l.action));
  if (overall !== raw.overall_action) warnings.push(`overall_action 불일치: 모델 ${raw.overall_action}, 줄 기준 ${overall}`);
  return { lines: judged, warnings };
}
