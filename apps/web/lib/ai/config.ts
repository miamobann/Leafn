// AI 제공사·모델 설정 한곳 (CLAUDE.md 2장 "AI 모델 사용 규칙"). 서버 전용
// 화면·Route Handler는 등급(precise·bulk)만 넘기고 제공사는 모른다. 제공사는 AI_PROVIDER로 바꾼다
export type AiProvider = "openai" | "anthropic";
export type AiTier = "precise" | "bulk";

export function aiProvider(): AiProvider {
  return process.env.AI_PROVIDER === "anthropic" ? "anthropic" : "openai";
}

// 2장 표의 기본 모델. Anthropic 대량 등급은 2장에 claude-haiku-5-5로 적혀 있으나 그런 ID가 없어 현행 Haiku를 쓴다 (11장 보고)
const DEFAULT_MODELS: Record<AiProvider, Record<AiTier, string>> = {
  openai: { precise: "gpt-4.1-mini", bulk: "gpt-4.1-mini" },
  anthropic: { precise: "claude-sonnet-5-5", bulk: "claude-haiku-4-5" },
};

export function aiModel(tier: AiTier): string {
  const override = tier === "precise" ? process.env.AI_MODEL_PRECISE : process.env.AI_MODEL_BULK;
  return override || DEFAULT_MODELS[aiProvider()][tier];
}

/**
 * GEO가 "측정하는" AI 검색 엔진의 모델. 제공사 선택(AI_PROVIDER)과 별개로, 소비자가 쓰는 엔진 각각에 질문한다.
 * 키가 없는 엔진은 쓸 수 없다 (lib/ai/geo/engines.ts)
 */
export const GEO_ENGINE_MODELS = {
  chatgpt: process.env.GEO_MODEL_CHATGPT || "gpt-4o",
  claude: process.env.GEO_MODEL_CLAUDE || "claude-sonnet-5-5",
} as const;

/** GEO 반복 횟수: 기본 1회, 정밀 모드(주간 배치 등)는 3회 */
export function geoRepeatCount(precise: boolean): number {
  if (precise) return 3;
  const n = Number(process.env.GEO_REPEAT_COUNT ?? 1);
  return Number.isInteger(n) && n >= 1 && n <= 3 ? n : 1;
}
