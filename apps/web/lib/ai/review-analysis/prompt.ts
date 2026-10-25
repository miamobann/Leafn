// 리뷰 분석 프롬프트 조립. 원문은 prompts/review-analysis.v<N>.md 에만 있다 (CLAUDE.md 7장).
import { loadPrompt } from "@/lib/ai/prompts";
import type { Lang } from "@/lib/schemas/common";

/** 리뷰 한 건에서 AI에게 보내는 글자 수 상한 (비용·시간을 막는다) */
export const MAX_BODY_CHARS = 600;

const LANG_LABEL: Record<Lang, string> = { ko: "한국어(ko)", ja: "일본어(ja)" };

/** 프롬프트 파일의 머리말(--- 앞)은 사람이 읽는 설명이라 빼고, 본문만 system 메시지로 쓴다 */
export async function buildSystemPrompt(version: number): Promise<{ text: string; version: string }> {
  const { text, version: id } = await loadPrompt("review-analysis", version);
  const body = text.split(/^---\s*$/m).slice(1).join("---").trim();
  if (!body.includes("#판단 단계") || !body.includes("#출력 형식")) throw new Error(`프롬프트 형식이 맞지 않습니다: ${id}`);
  return { text: body, version: id };
}

export type PromptReview = { body: string };

/** 번호([1], [2]…)를 붙인 리뷰 묶음. 줄바꿈은 공백으로 바꾸고 너무 긴 글은 자른다 */
export function buildUserMessage(input: { lang: Lang; category: string | null; reviews: PromptReview[] }): string {
  const lines = input.reviews.map((r, i) => `[${i + 1}] ${r.body.replace(/\s+/g, " ").trim().slice(0, MAX_BODY_CHARS)}`);
  return [
    "#입력",
    `언어: ${LANG_LABEL[input.lang]}`,
    `제품 종류: ${input.category ?? "알 수 없음"}`,
    `리뷰 ${input.reviews.length}건`,
    "'''",
    ...lines,
    "'''",
    `위 리뷰 ${input.reviews.length}건을 번호 1부터 ${input.reviews.length}까지 빠짐없이 분석하세요.`,
  ].join("\n");
}
