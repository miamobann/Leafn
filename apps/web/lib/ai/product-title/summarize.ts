// 제품명 정리 (대량 등급): 긴 일본어 제품명 → 브랜드 · 짧은 제품명 · 용량 · 대표 성분 + 한국어.
// 응답 모양 오류만 1회 재시도하고, 호출·설정 오류는 그대로 던진다. 프롬프트 원문은 prompts/product-title.v<N>.md 에만 있다 (CLAUDE.md 7장).
// AI가 제목에 없는 용량·성분을 지어내지 못하게, 코드가 한 번 더 제목과 맞춰 본다 (normalizeTitle).
import { callAi, type AiReply, type AiRequest, type AiUsage } from "@/lib/ai/client";
import { loadPrompt } from "@/lib/ai/prompts";
import { AiProductTitleBatch, type AiProductTitle } from "@/lib/schemas/product-title-ai";
import type { ProductTitleAi } from "@/lib/schemas/product";

export const PRODUCT_TITLE_PROMPT_VERSION = 1;
/** 한 번에 정리하는 제품 수 */
export const PRODUCT_TITLE_BATCH = 30;
const MAX_TITLE_CHARS = 300;
const MAX_ATTEMPTS = 2;

/** AI 응답이 약속한 모양이 아닐 때. message 는 화면에 보여 줘도 안전하다 (모델 출력 원문은 cause 에만 있다) */
export class ProductTitleParseError extends Error {
  constructor(reason: string, cause?: unknown) {
    super(`AI 응답 형식이 맞지 않아 제품명을 정리하지 못했습니다 (${reason})`, { cause });
  }
}

export type TitleInput = { brand: string; title: string };

export type SummarizeResult = {
  /** 입력한 순서 그대로. model · prompt_version 포함 */
  titles: ProductTitleAi[];
  usage: AiUsage;
  model: string;
  promptVersion: string;
  attempts: number;
};

type Deps = { /** 시험에서 가짜 호출을 끼울 때만 쓴다 */ call?: (request: AiRequest) => Promise<AiReply> };

async function buildSystemPrompt(version: number) {
  const { text, version: id } = await loadPrompt("product-title", version);
  const body = text.split(/^---\s*$/m).slice(1).join("---").trim();
  if (!body.includes("#정리 규칙") || !body.includes("#출력 형식")) throw new Error(`프롬프트 형식이 맞지 않습니다: ${id}`);
  return { text: body, version: id };
}

export function buildTitleMessage(inputs: TitleInput[]): string {
  const lines = inputs.map((p, i) => `[${i + 1}] 브랜드: ${p.brand.trim() || "(없음)"} | 제목: ${p.title.replace(/\s+/g, " ").trim().slice(0, MAX_TITLE_CHARS)}`);
  return ["#입력", `상품 ${inputs.length}개`, "'''", ...lines, "'''", `위 상품 ${inputs.length}개를 번호 1부터 ${inputs.length}까지 빠짐없이 정리하세요.`].join("\n");
}

const clean = (v: string | null) => {
  const t = v?.trim();
  return t ? t : null;
};

/** 전각 숫자(１５０)를 반각(150)으로 바꿔 비교한다 */
const halfWidth = (s: string) => s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

/**
 * AI 결과를 정리하고 제목과 맞춰 본다.
 * - 용량의 숫자가 제목에 하나라도 없으면 용량을 비운다 (계산하거나 추측한 용량 방지)
 * - 대표 성분의 일본어 표기가 제목에 없으면 성분을 둘 다 비운다
 */
export function normalizeTitle(ai: AiProductTitle, input: TitleInput, meta: { model: string; prompt_version: string }): ProductTitleAi {
  const title = halfWidth(input.title);
  const volume = clean(ai.volume)?.replace(/\s*\/\s*/g, "/") ?? null;
  const numbers = volume ? (volume.match(/\d+(?:\.\d+)?/g) ?? []) : [];
  const volumeOk = volume !== null && numbers.length > 0 && numbers.every((n) => title.includes(n));

  const ingredientJa = clean(ai.key_ingredient_ja);
  const ingredientOk = ingredientJa !== null && input.title.includes(ingredientJa);

  return {
    brand_ko: clean(ai.brand_ko),
    name_short_ja: ai.name_short_ja.trim() || input.title.trim().slice(0, 40),
    name_ko: ai.name_ko.trim(),
    volume: volumeOk ? volume : null,
    key_ingredient_ja: ingredientOk ? ingredientJa : null,
    key_ingredient_ko: ingredientOk ? clean(ai.key_ingredient_ko) : null,
    ...meta,
  };
}

export function parseTitles(text: string, inputs: TitleInput[], meta: { model: string; prompt_version: string }): ProductTitleAi[] {
  let json: unknown;
  try {
    json = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  } catch (e) {
    throw new ProductTitleParseError("JSON 아님", e);
  }
  const parsed = AiProductTitleBatch.safeParse(json);
  if (!parsed.success) throw new ProductTitleParseError("필드 오류", parsed.error);
  const byNumber = new Map<number, AiProductTitle>();
  for (const r of parsed.data.results) {
    if (r.n < 1 || r.n > inputs.length) throw new ProductTitleParseError(`번호 범위 밖: ${r.n}`);
    if (byNumber.has(r.n)) throw new ProductTitleParseError(`번호 중복: ${r.n}`);
    if (!r.name_ko.trim()) throw new ProductTitleParseError(`빈 번역: ${r.n}`);
    byNumber.set(r.n, r);
  }
  if (byNumber.size !== inputs.length) throw new ProductTitleParseError(`건수 불일치: ${byNumber.size}/${inputs.length}`);
  return inputs.map((input, i) => normalizeTitle(byNumber.get(i + 1)!, input, meta));
}

export async function summarizeProductTitles(inputs: TitleInput[], deps: Deps = {}): Promise<SummarizeResult> {
  if (inputs.length < 1 || inputs.length > PRODUCT_TITLE_BATCH) throw new Error(`한 번에 1~${PRODUCT_TITLE_BATCH}개: ${inputs.length}개`);
  const call = deps.call ?? callAi;
  const system = await buildSystemPrompt(PRODUCT_TITLE_PROMPT_VERSION);
  const user = buildTitleMessage(inputs);

  const usage: AiUsage = { input: 0, cached: 0, output: 0 };
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const reply = await call({ grade: "bulk", system: system.text, user, schema: { name: "product_title", zod: AiProductTitleBatch } });
    usage.input += reply.usage.input;
    usage.cached += reply.usage.cached;
    usage.output += reply.usage.output;
    try {
      const titles = parseTitles(reply.text, inputs, { model: reply.model, prompt_version: system.version });
      return { titles, usage, model: reply.model, promptVersion: system.version, attempts: attempt };
    } catch (e) {
      if (!(e instanceof ProductTitleParseError)) throw e;
      lastError = e;
    }
  }
  throw lastError;
}
