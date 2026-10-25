// 목록에 보여 줄 한국어 문구 (검토 이력). 줄마다: 일본어 줄은 그 줄의 한국어 번역, 한국어 줄은 원문.
// 번역이 없는 일본어 줄(프롬프트 v6 이전 검토 등)은 원문을 쓰고 표시해 둔다.
import type { AdCheck } from "@/lib/schemas/ad-check";

const hasKana = (text: string) => /[぀-ヿ]/.test(text);

export type KoLine = { text: string; untranslated: boolean };

export function koLines(check: AdCheck): KoLine[] {
  const lines = check.line_results ?? [];
  if (lines.length === 0) return check.input_text.split("\n").map((t) => ({ text: t, untranslated: hasKana(t) }));
  // 줄별 번역이 없고 검토 전체 번역만 있는 경우(예전 저장 형식)는 줄 수가 같을 때만 줄마다 나눠 쓴다
  const whole = check.back_translation_ko?.split("\n") ?? [];
  const wholeFits = whole.length === lines.length;
  return lines.map((l, i) => {
    if (!hasKana(l.original)) return { text: l.original, untranslated: false };
    const ko = l.back_translation_ko?.trim() || (wholeFits ? whole[i]?.trim() : "");
    return ko ? { text: ko, untranslated: false } : { text: l.original, untranslated: true };
  });
}
