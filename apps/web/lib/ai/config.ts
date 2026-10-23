// AI 제공사·모델 설정의 한 곳 (CLAUDE.md 2장 "AI 모델 사용 규칙"). 모델 ID는 여기서만 정한다.
// 호출하는 쪽은 모델 이름이 아니라 등급(정밀·대량)만 넘긴다. 시작 시점의 최신 버전으로 갱신한다.

export const AI_PROVIDERS = ["openai", "anthropic"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const AI_GRADES = ["precise", "bulk"] as const;
export type AiGrade = (typeof AI_GRADES)[number];

/** 등급 → 모델 (2장 표). precise = 정밀(약기법 위험 판단 등), bulk = 대량(리뷰 분석 등) */
const DEFAULT_MODELS: Record<AiProvider, Record<AiGrade, string>> = {
  openai: { precise: "gpt-4.1-mini", bulk: "gpt-4.1-mini" },
  anthropic: { precise: "claude-sonnet-5-5", bulk: "claude-haiku-5-5" },
};

/** 환경 설정이 잘못됐을 때. 메시지에는 키나 값을 넣지 않는다 */
export class AiConfigError extends Error {}

/** 제공사: AI_PROVIDER 환경 변수, 없으면 openai */
export function resolveProvider(): AiProvider {
  const value = process.env.AI_PROVIDER?.trim() || "openai";
  const found = AI_PROVIDERS.find((p) => p === value);
  if (!found) throw new AiConfigError(`AI_PROVIDER 는 ${AI_PROVIDERS.join(" 또는 ")} 이어야 합니다`);
  return found;
}

/** 모델: AI_MODEL_PRECISE / AI_MODEL_BULK 로 덮어쓸 수 있고, 없으면 위 기본값 */
export function resolveModel(provider: AiProvider, grade: AiGrade): string {
  const override = (grade === "precise" ? process.env.AI_MODEL_PRECISE : process.env.AI_MODEL_BULK)?.trim();
  return override || DEFAULT_MODELS[provider][grade];
}
