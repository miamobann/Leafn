import type { SkinType, SurveySession } from "@/lib/schemas/survey";

// 저장 연결은 DB 관리자가 supabase/migrations/20261023030815_survey.sql을 적용한 뒤에 한다. 지금은 어디에도 보내지 않는다.
// 연결할 때 지킬 분기:
//  - 18세 미만: rpc("record_survey_minor", { p_slug })만 부른다. 답 · 나이 · 결과 · 유입 경로는 보내지 않는다
//  - 18세 이상: consent_at이 있을 때만 survey_responses에 insert. 익명은 읽기 권한이 없으므로 insert 결과를 돌려받지 않는다
export async function submitSurvey(session: SurveySession, under18: boolean): Promise<void> {
  if (under18) return;
  if (!session.consent_at) return;
}

export type RecoEvent = { event: "shown" | "buy_click" | "notify_open"; lineId: string; skinType: SkinType; under18: boolean };

// 추천 노출 · 클릭 기록 (survey_reco_events). 연결 전이라 지금은 보내지 않는다. 18세 미만은 기록하지 않는다
export function trackReco(e: RecoEvent): void {
  if (e.under18) return;
}
