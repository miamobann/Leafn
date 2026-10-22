import type { SurveySession } from "@/lib/schemas/survey";

// 저장 연결은 설문 테이블 합의 후에 한다 (docs/db-frame.md "소비자 설문"). 지금은 어디에도 보내지 않는다.
// 연결할 때 지킬 분기:
//  - 18세 미만: 답 · 나이 · 결과는 보내지 않고 "18세 미만 참여 +1" 숫자만 보낸다
//  - 18세 이상: 동의(consent_at)가 있을 때만 비식별 응답 1건을 보낸다
export async function submitSurvey(session: SurveySession, under18: boolean): Promise<void> {
  if (under18) return;
  if (!session.consent_at) return;
}
