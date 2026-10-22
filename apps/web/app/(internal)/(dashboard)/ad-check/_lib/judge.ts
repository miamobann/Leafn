// 프로토타입용 "검토 엔진". 입력한 줄이 샘플 문구와 같으면 그 샘플 판정을 돌려주고,
// 아니면 "전문가 확인"으로 표시한다. 실제 AI 연결 때 이 파일을 lib/ai/ 호출로 바꾼다.
import type { Action, LineResult, SampleCopy, SampleJudgment } from "./types";

export const MAX_LINES = 20;

const ACTION_SEVERITY: Record<Action, number> = { must_fix: 3, should_fix: 2, expert: 1, ok: 0 };

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function detectLang(text: string): "ko" | "ja" {
  return /[぀-ヿ]/.test(text) ? "ja" : "ko";
}

export function splitInput(text: string): string[] {
  return text
    .split("\n")
    .map(normalize)
    .filter((line) => line.length > 0)
    .slice(0, MAX_LINES);
}

export function judgeLine(
  original: string,
  lineIndex: number,
  copies: SampleCopy[],
  judgments: SampleJudgment[],
): LineResult {
  const target = normalize(original);
  const copy = copies.find((c) => normalize(c.ko) === target || normalize(c.jaLiteral) === target);
  const judgment = copy && judgments.find((j) => j.sampleId === copy.id);

  if (!copy || !judgment) {
    return {
      lineIndex,
      original,
      inputLang: detectLang(original),
      action: "expert",
      findings: [],
      ingredientCheck: "샘플에 없는 문구라 확인하지 않음",
      suggestions: [],
      translatedText: null,
      backTranslationKo: null,
      localizedNote: "샘플에 없는 문구입니다. 실제 AI 판정은 연결 후 제공됩니다",
      sampleProductId: null,
      sampleId: null,
    };
  }

  // 일본어 원문을 넣었으면 번역·역번역은 보여주지 않는다
  const isJa = normalize(copy.jaLiteral) === target;
  return {
    ...judgment,
    lineIndex,
    original,
    inputLang: isJa ? "ja" : "ko",
    translatedText: isJa ? null : judgment.translatedText,
    backTranslationKo: isJa ? null : judgment.backTranslationKo,
    sampleProductId: copy.productId,
    sampleId: copy.id,
  };
}

export function overallAction(lines: LineResult[]): Action {
  return lines.reduce<Action>(
    (worst, line) => (ACTION_SEVERITY[line.action] > ACTION_SEVERITY[worst] ? line.action : worst),
    "ok",
  );
}

export function countByAction(lines: LineResult[]): Record<Action, number> {
  const counts: Record<Action, number> = { must_fix: 0, should_fix: 0, expert: 0, ok: 0 };
  for (const line of lines) counts[line.action] += 1;
  return counts;
}
