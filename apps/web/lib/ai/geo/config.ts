// GEO 전용 설정 (서버 전용). 제공사·등급 설정(lib/ai/config.ts)과 별개다:
// GEO는 AI_PROVIDER로 고른 제공사가 아니라, 소비자가 쓰는 AI 검색 엔진 각각을 "측정 대상"으로 부른다

/** GEO가 질문하는 엔진의 모델 (키가 없는 엔진은 쓸 수 없다 · engines.ts) */
export const GEO_ENGINE_MODELS = {
  chatgpt: process.env.GEO_MODEL_CHATGPT || "gpt-4o",
  claude: process.env.GEO_MODEL_CLAUDE || "claude-sonnet-5-5",
} as const;

/** GEO 반복 횟수: 기본 1회(GEO_REPEAT_COUNT), 정밀 모드는 3회 */
export function geoRepeatCount(precise: boolean): number {
  if (precise) return 3;
  const n = Number(process.env.GEO_REPEAT_COUNT ?? 1);
  return Number.isInteger(n) && n >= 1 && n <= 3 ? n : 1;
}
