// 콘텐츠 제작 가이드 AI 호출: ① 제목 3개(대량 등급) → ② 고른 제목으로 본문(정밀 등급).
// 출력은 구조화 출력으로 모양을 강제하고 Zod로 한 번 더 검증한다. 검증 실패 시 1회 재시도 (CLAUDE.md 7장 1번).
import type { z } from "zod";
import { callAi, type AiReply, type AiRequest, type AiUsage } from "@/lib/ai/client";
import { type ContentGuideInput, type GuideTitle, GuideBodyResult, GuideTitlesResult } from "@/lib/schemas/content-guide";
import { type LintHit, lintBody } from "./lint";
import { buildSystemPrompt, buildUserMessage, type GuideStep } from "./prompt";

/** 지금 쓰는 프롬프트 버전. 저장하는 prompt_version 은 "content-guide.<버전>" */
export const CONTENT_GUIDE_PROMPT_VERSION = "v5";

/** AI 응답이 두 번 모두 약속한 모양이 아닐 때. message 는 화면에 보여 줘도 안전하다 */
export class ContentGuideParseError extends Error {
  constructor(cause: unknown) {
    super("AI 응답 형식이 맞지 않아 만들지 못했습니다", { cause });
  }
}

export type Generated<T> = { result: T; usage: AiUsage; model: string; promptVersion: string; attempts: number };

const MAX_ATTEMPTS = 2;

type Deps = { /** 시험에서 가짜 호출을 끼울 때만 쓴다 */ call?: (request: AiRequest) => Promise<AiReply> };

async function run<T>(step: GuideStep, grade: AiRequest["grade"], user: string, schema: z.ZodType<T>, check: (r: T) => void, deps: Deps): Promise<Generated<T>> {
  const call = deps.call ?? callAi;
  const system = buildSystemPrompt(step, CONTENT_GUIDE_PROMPT_VERSION);
  const usage: AiUsage = { input: 0, cached: 0, output: 0 };
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const reply = await call({ grade, system, user, schema: { name: `content_guide_${step}`, zod: schema } });
    usage.input += reply.usage.input;
    usage.cached += reply.usage.cached;
    usage.output += reply.usage.output;
    try {
      const result = schema.parse(JSON.parse(reply.text));
      check(result);
      return { result, usage, model: reply.model, promptVersion: `content-guide.${CONTENT_GUIDE_PROMPT_VERSION}`, attempts: attempt };
    } catch (e) {
      lastError = e;
    }
  }
  throw new ContentGuideParseError(lastError);
}

/** ① 제목 3개. 가장 추천은 1개, 맨 앞 */
export function generateTitles(input: ContentGuideInput, deps: Deps = {}) {
  return run("titles", "bulk", buildUserMessage(input), GuideTitlesResult, (r) => {
    if (r.titles.length !== 3) throw new Error(`제목은 3개여야 함: ${r.titles.length}개`);
    if (r.titles.filter((t) => t.recommended).length !== 1 || !r.titles[0]?.recommended) throw new Error("가장 추천은 1개이고 맨 앞이어야 함");
    // 상품명 끝의 효능 3개에 성분명·각주가 섞이면 다시 만든다 (프롬프트로만은 가끔 섞여 나온다)
    if (input.channel === "qoo10_detail" && r.titles.some((t) => /[*＊]|配合|酸/.test(t.title_ja.split(" / ").at(-1) ?? ""))) throw new Error("상품명 효능 칸에 성분명·각주가 있음");
  }, deps);
}

/** 채널별 첫 블록 key (규칙 문서 01의 블록 순서) */
const FIRST_BLOCK: Record<ContentGuideInput["channel"], string> = { qoo10_detail: "hook", instagram: "caption", x: "post", banner: "copy" };

/** ② 고른 제목으로 본문. 금지어가 나오면 한 번 더 만들고, 그래도 남으면 lintHits 로 돌려줘 화면에서 경고한다 */
export async function generateBody(input: ContentGuideInput, picked: GuideTitle, deps: Deps = {}): Promise<Generated<GuideBodyResult> & { lintHits: LintHit[] }> {
  let made = await bodyOnce(input, picked, deps);
  let hits = lintBody(made.result);
  if (hits.length > 0) {
    const again = await bodyOnce(input, picked, deps);
    const againHits = lintBody(again.result);
    const usage = { input: made.usage.input + again.usage.input, cached: made.usage.cached + again.usage.cached, output: made.usage.output + again.usage.output };
    if (againHits.length < hits.length) [made, hits] = [again, againHits];
    made = { ...made, usage };
  }
  // 상세페이지·배너는 해시태그를 쓰지 않는다 (검색은 상품명으로 걸린다)
  const result = input.channel === "qoo10_detail" || input.channel === "banner" ? { ...made.result, hashtags: { brand: [], ingredient: [], trend: [] } } : made.result;
  return { ...made, result, lintHits: hits };
}

function bodyOnce(input: ContentGuideInput, picked: GuideTitle, deps: Deps) {
  return run("body", "precise", buildUserMessage(input, picked), GuideBodyResult, (r) => {
    if (r.blocks[0]?.key !== FIRST_BLOCK[input.channel]) throw new Error(`첫 블록은 ${FIRST_BLOCK[input.channel]} 이어야 함`);
    if (r.blocks.some((b) => b.options.length < 1 || b.options.length > 2)) throw new Error("블록마다 안은 1~2개");
    if (input.channel === "qoo10_detail" && r.gallery.length !== 5) throw new Error(`대표 이미지는 5장: ${r.gallery.length}장`);
  }, deps);
}
