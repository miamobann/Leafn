import { createClient } from "@/lib/supabase/client";
import { calcScores, judge } from "@/lib/survey/judge";
import type { SkinType, SurveyQuestion, SurveySession, SurveySource } from "@/lib/schemas/survey";

// 공개 설문 저장 (supabase/migrations/20261023030815_survey.sql의 익명 입력 규칙을 쓴다).
//  - 18세 미만: rpc("record_survey_minor", { p_slug })만 부른다. 답 · 나이 · 결과 · 유입 경로는 보내지 않는다
//  - 18세 이상: consent_at이 있을 때만 survey_responses에 insert. 익명은 읽기 권한이 없으므로 insert 결과를 돌려받지 않는다
// 저장이 실패해도 응답자는 결과를 볼 수 있어야 하므로 오류는 콘솔에만 남긴다.
// Supabase 환경 변수가 없으면(샘플 모드) 아무 데도 보내지 않는다.

/** 이 앱의 공개 설문. 열린 surveys 행이 있어야 저장된다 (supabase/seeds/survey_open.sql) */
export const SURVEY_SLUG = "leafn";

const configured = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

type OpenSurvey = { id: string; workspace_id: string };
let surveyPromise: Promise<OpenSurvey | null> | null = null;

/** 열린 설문의 id · workspace_id. 페이지 안에서 한 번만 찾는다 */
function openSurvey(): Promise<OpenSurvey | null> {
  surveyPromise ??= (async () => {
    const { data, error } = await createClient()
      .from("surveys")
      .select("id, workspace_id")
      .eq("public_slug", SURVEY_SLUG)
      .eq("is_open", true)
      .maybeSingle<OpenSurvey>();
    if (error || !data) {
      console.error("설문 저장: 열린 설문을 찾지 못했습니다", error?.message ?? SURVEY_SLUG);
      surveyPromise = null;
      return null;
    }
    return data;
  })();
  return surveyPromise;
}

export async function submitSurvey(session: SurveySession, under18: boolean, questions: SurveyQuestion[]): Promise<void> {
  if (!configured()) return;
  try {
    if (under18) {
      const { error } = await createClient().rpc("record_survey_minor", { p_slug: SURVEY_SLUG });
      if (error) console.error("설문 저장: 18세 미만 참여 수 실패", error.message);
      return;
    }
    if (!session.consent_at || !session.consent_version) return;
    const survey = await openSurvey();
    if (!survey) return;
    const scores = calcScores(questions, session.answers);
    const { skinType, isSensitive } = judge(scores);
    const concerns = session.answers.concerns;
    const { error } = await createClient()
      .from("survey_responses")
      .insert({
        workspace_id: survey.workspace_id,
        survey_id: survey.id,
        answers: session.answers,
        age_group: session.answers.age,
        skin_type: skinType,
        is_sensitive: isSensitive,
        score_t_zone_oil: scores.t,
        score_cheek_oil: scores.c,
        score_dryness: scores.d,
        score_sensitivity: scores.s,
        concerns: Array.isArray(concerns) ? concerns : [],
        concern_other: session.other_text || null,
        source: session.source,
        source_other: session.source_other || null,
        consent_at: session.consent_at,
        consent_version: session.consent_version,
        locale: "ja",
      });
    if (error) console.error("설문 저장: 응답 저장 실패", error.message);
  } catch (e) {
    console.error("설문 저장: 연결 실패", e);
  }
}

/** source는 응답자의 유입 경로 (링크 꼬리표 또는 마지막 문항). 채널별 클릭 · 알림 집계에 쓴다 */
export type RecoEvent = {
  event: "shown" | "buy_click" | "notify_open";
  lineId: string;
  skinType: SkinType;
  source: SurveySource | null;
  under18: boolean;
};

/** 추천 노출 · 클릭 기록 (survey_reco_events). 18세 미만은 기록하지 않는다. 화면을 막지 않게 기다리지 않는다 */
export function trackReco(e: RecoEvent): void {
  if (e.under18 || !configured()) return;
  void (async () => {
    const survey = await openSurvey();
    if (!survey) return;
    const { error } = await createClient().from("survey_reco_events").insert({
      workspace_id: survey.workspace_id,
      survey_id: survey.id,
      product_line: e.lineId,
      event: e.event,
      skin_type: e.skinType,
      source: e.source,
    });
    if (error) console.error("설문 저장: 추천 기록 실패", error.message);
  })().catch((err) => console.error("설문 저장: 연결 실패", err));
}
