// 통합 AI 분석 설정 (docs/team-approval-ai-analysis.md 10장).
// 프롬프트를 고칠 때는 지금 쓰는 prompts/integrated-analysis.v<N>.md를 v<N+1>로 복사해 고친 뒤 이 상수만 바꾼다. 이미 쓴 버전 파일은 고치지 않는다.

/** 지금 쓰는 프롬프트 버전 (prompts/integrated-analysis.v<N>.md). 저장하는 prompt_version은 "integrated-analysis.v<N>" */
export const PROMPT_VERSION = 4;

/** 고른 승인본들의 데이터 기준 날짜가 이 날 수보다 벌어지면 선택 화면에서 경고한다 (설계 8장 보완 2) */
export const MAX_DATA_GAP_DAYS = 30;

/** 리뷰 승인본의 분석 건수가 이보다 적으면 facts.review_sample_small = true (프롬프트 #판단 단계의 "30건"과 같은 값) */
export const MIN_REVIEW_SAMPLE = 30;

/** 프롬프트 v4부터 같이 보내는 프로모션 일정: 오늘부터 이 날 수 안에 걸친 행사, 최대 개수 (프롬프트 #입력 형식의 "90일"과 같은 값) */
export const CALENDAR_DAYS = 90;
export const MAX_CALENDAR_EVENTS = 8;

/** 설문 요약의 ref. 승인본이 아닌 참고 데이터라 버전 ID가 없다 (프롬프트 v4 #입력 형식) */
export const SURVEY_REF = "survey@ref";
