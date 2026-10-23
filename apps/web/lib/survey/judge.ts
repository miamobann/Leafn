import type { ScoreKey, Scores, SkinType, SurveyAnswer, SurveyQuestion } from "@/lib/schemas/survey";

// 판정 기준 (가안, 자체 기준). 일본 성인 여성 피부타입 자기인식 비율(混合39 · 普通29 · 敏感23 · 乾燥11%)에 맞춘
// 가상 응답자로 고른 값이다. 실제 응답이 쌓이면 다시 맞춘다 (응답마다 원래 답을 저장하므로 다시 분류할 수 있다)
export const RULE = { tOil: 4, cOil: 4, dry: 5, sens: 4 } as const;

const KEYS: ScoreKey[] = ["t", "c", "d", "s"];
const EMPTY: Scores = { t: 0, c: 0, d: 0, s: 0 };

function asList(answer: SurveyAnswer | undefined): string[] {
  if (answer === undefined) return [];
  return Array.isArray(answer) ? answer : [answer];
}

export function calcScores(questions: SurveyQuestion[], answers: Record<string, SurveyAnswer>): Scores {
  const sc = { ...EMPTY };
  for (const q of questions) {
    const picked = asList(answers[q.id]);
    if (q.count_score) {
      // 복수 선택: 고른 개수만큼 점수 ("해당 없음" 제외, 최대 max)
      const n = picked.filter((v) => !q.options.find((o) => o.value === v)?.is_none).length;
      sc[q.count_score.key] += Math.min(n, q.count_score.max);
      continue;
    }
    for (const v of picked) {
      const score = q.options.find((o) => o.value === v)?.score;
      for (const k of KEYS) sc[k] += score?.[k] ?? 0;
    }
  }
  return sc;
}

/** 점수별 최댓값 (문항에서 계산). 결과 화면 막대의 100% 기준 */
export function maxScores(questions: SurveyQuestion[]): Scores {
  const max = { ...EMPTY };
  for (const q of questions) {
    if (q.count_score) {
      max[q.count_score.key] += q.count_score.max;
      continue;
    }
    for (const k of KEYS) max[k] += Math.max(0, ...q.options.map((o) => o.score?.[k] ?? 0));
  }
  return max;
}

/** 볼 유분 → 얼굴 전체 번들, T존 유분 → 부분 번들, 건조는 따로. 민감은 유형과 별도로 표시한다 */
export function judge(sc: Scores): { skinType: SkinType; isSensitive: boolean } {
  const tOil = sc.t >= RULE.tOil;
  const cOil = sc.c >= RULE.cOil;
  const dry = sc.d >= RULE.dry;
  let skinType: SkinType = "normal";
  if (cOil) skinType = dry ? "inner_dry" : "oily";
  else if (tOil) skinType = "combo";
  else if (dry) skinType = "dry";
  return { skinType, isSensitive: sc.s >= RULE.sens };
}

export function isUnder18(questions: SurveyQuestion[], answers: Record<string, SurveyAnswer>): boolean {
  const ageQuestion = questions.find((q) => q.options.some((o) => o.is_under18));
  if (!ageQuestion) return false;
  const picked = asList(answers[ageQuestion.id]);
  return picked.some((v) => ageQuestion.options.find((o) => o.value === v)?.is_under18);
}
