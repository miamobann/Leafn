// 통합 AI 분석 설정 (docs/team-approval-ai-analysis.md 10장).
// 프롬프트를 고칠 때는 지금 쓰는 prompts/integrated-analysis.v<N>.md를 v<N+1>로 복사해 고친 뒤 이 상수만 바꾼다. 이미 쓴 버전 파일은 고치지 않는다.

/** 지금 쓰는 프롬프트 버전 (prompts/integrated-analysis.v<N>.md). 저장하는 prompt_version은 "integrated-analysis.v<N>" */
export const PROMPT_VERSION = 3;

/** 고른 승인본들의 데이터 기준 날짜가 이 날 수보다 벌어지면 선택 화면에서 경고한다 (설계 8장 보완 2) */
export const MAX_DATA_GAP_DAYS = 30;

/** 리뷰 승인본의 분석 건수가 이보다 적으면 facts.review_sample_small = true (프롬프트 #판단 단계의 "30건"과 같은 값) */
export const MIN_REVIEW_SAMPLE = 30;
