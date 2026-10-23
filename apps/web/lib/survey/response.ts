import { SurveyResponseInsert, type SurveyAnswer, type SurveyQuestion, type SurveySession } from "@/lib/schemas/survey";
import { calcScores, isUnder18, judge } from "./judge";

// 브라우저가 보낸 답을 저장할 행으로 바꾼다 (서버에서 부른다).
// 점수 · 피부타입은 브라우저 값을 믿지 않고 여기서 다시 계산한다. 답이 문항과 맞지 않으면 저장하지 않는다
export type BuiltResponse = { kind: "adult"; row: SurveyResponseInsert } | { kind: "minor" } | { kind: "invalid"; reason: string };

const AGE_QUESTION = "age";
const CONCERNS_QUESTION = "concerns";
// 브라우저 시계가 조금 빨라도 받아 준다
const CLOCK_SKEW_MS = 5 * 60_000;

function checkAnswer(q: SurveyQuestion, answer: SurveyAnswer | undefined): string | null {
  const values = new Set(q.options.map((o) => o.value));
  if (!q.multi) return typeof answer === "string" && values.has(answer) ? null : `${q.id}: 선택지에 없는 답`;
  if (!Array.isArray(answer) || answer.length === 0) return `${q.id}: 답 없음`;
  if (new Set(answer).size !== answer.length || answer.some((v) => !values.has(v))) return `${q.id}: 선택지에 없는 답`;
  const hasNone = answer.some((v) => q.options.find((o) => o.value === v)?.is_none);
  if (hasNone && answer.length > 1) return `${q.id}: "해당 없음"과 다른 답을 같이 고름`;
  return null;
}

export function buildSurveyResponse(questions: SurveyQuestion[], session: SurveySession, now: Date): BuiltResponse {
  const ids = new Set(questions.map((q) => q.id));
  const extra = Object.keys(session.answers).find((id) => !ids.has(id));
  if (extra) return { kind: "invalid", reason: `없는 문항: ${extra}` };
  for (const q of questions) {
    const problem = checkAnswer(q, session.answers[q.id]);
    if (problem) return { kind: "invalid", reason: problem };
  }

  // 18세 미만은 답을 저장하지 않는다 (참여 수만 따로 센다)
  if (isUnder18(questions, session.answers)) return { kind: "minor" };

  if (!session.consent_at || !session.consent_version) return { kind: "invalid", reason: "동의 없음" };
  if (Date.parse(session.consent_at) > now.getTime() + CLOCK_SKEW_MS) return { kind: "invalid", reason: "동의 시각이 미래" };

  const scores = calcScores(questions, session.answers);
  const { skinType, isSensitive } = judge(scores);
  const concernsQuestion = questions.find((q) => q.id === CONCERNS_QUESTION);
  const concernsAnswer = session.answers[CONCERNS_QUESTION];
  const concerns = Array.isArray(concernsAnswer) ? concernsAnswer : [];
  const otherPicked = concerns.some((v) => concernsQuestion?.options.find((o) => o.value === v)?.is_other);

  const row = SurveyResponseInsert.safeParse({
    answers: session.answers,
    age_group: session.answers[AGE_QUESTION],
    skin_type: skinType,
    is_sensitive: isSensitive,
    score_t_zone_oil: scores.t,
    score_cheek_oil: scores.c,
    score_dryness: scores.d,
    score_sensitivity: scores.s,
    concerns,
    concern_other: otherPicked ? session.other_text.trim() || null : null,
    source: session.source,
    source_other: session.source === "other" ? session.source_other.trim() || null : null,
    consent_at: session.consent_at,
    consent_version: session.consent_version,
    locale: "ja",
  });
  if (!row.success) return { kind: "invalid", reason: row.error.message };
  return { kind: "adult", row: row.data };
}
