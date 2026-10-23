import { recordSurveyMinor, submitSurveyResponse } from "@/lib/data/survey-actions";
import type { SkinType, SurveySession } from "@/lib/schemas/survey";

// 문항을 다 답하면 부른다. 저장이 실패해도 결과 화면은 그대로 보여 준다
//  - 18세 미만: 참여 수 +1만 보낸다. 답 · 나이 · 결과 · 유입 경로는 서버에 보내지 않는다
//  - 18세 이상: 동의했을 때만 보낸다. 서버가 답을 다시 검증하고 점수 · 피부타입을 다시 계산해 저장한다
export async function submitSurvey(session: SurveySession, under18: boolean): Promise<void> {
  try {
    if (under18) await recordSurveyMinor();
    else if (session.consent_at) await submitSurveyResponse(session);
  } catch {
    // 네트워크 오류 등. 응답자에게는 알리지 않는다
  }
}

export type RecoEvent = { event: "shown" | "buy_click" | "notify_open"; lineId: string; skinType: SkinType; under18: boolean };

// 추천 노출 · 클릭 기록 (survey_reco_events). 연결 전이라 지금은 보내지 않는다. 18세 미만은 기록하지 않는다
export function trackReco(e: RecoEvent): void {
  if (e.under18) return;
}
