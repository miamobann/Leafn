// 판정 프롬프트 시험 도구 (연습장 Suyeon-lab 전용). 화면에서 부르지 않고 터미널(run-lab.ts)에서만 쓴다.
// 정식 구현 때는 호출부(callModel)를 lib/ai/ 로 옮기고 Claude 호출로 바꾼다 (CLAUDE.md 2장).
// 토큰 절약 방침: 고정 내용(system)은 맨 앞, 바뀌는 내용(user)은 맨 뒤 → 앞부분 자동 캐시가 먹는다.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { AdAction, AdFinding, AdUsage, BasisStatus, SuggestionRecheck } from "@/lib/schemas/ad-check";
import { Risk } from "@/lib/schemas/common";
import { MAX_LINES, worstAction } from "./judge";
import type { LabProduct } from "./products";

// 프롬프트 5장과 같은 규칙 (judge.ts 의 표는 export 되어 있지 않아 따로 둔다)
const RISK_BY_ACTION: Record<AdAction, Risk> = { must_fix: "high", should_fix: "medium", expert: "medium", ok: "low" };

const PROMPT_MARKER = "=== PROMPT START ===";
const KNOWLEDGE_SLOT = "{{KNOWLEDGE}}";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

// 터미널은 apps/web 에서 실행한다고 가정한다
const WEB_DIR = process.cwd();
const PROMPTS_DIR = path.join(WEB_DIR, "prompts");
const KNOWLEDGE_DIR = path.join(WEB_DIR, "..", "..", "knowledge", "yakkiho");

// ---------- 프롬프트 조립 ----------

/** prompts/ad-check.<version>.md 에서 머리말을 떼고 {{KNOWLEDGE}} 에 기준 자료 6개를 이어 붙인다 */
export function buildSystemPrompt(version: string): string {
  const raw = readFileSync(path.join(PROMPTS_DIR, `ad-check.${version}.md`), "utf-8");
  const at = raw.indexOf(PROMPT_MARKER);
  if (at < 0) throw new Error(`ad-check.${version}.md 에 ${PROMPT_MARKER} 줄이 없음`);
  const body = raw.slice(at + PROMPT_MARKER.length).trim();
  if (body.split(KNOWLEDGE_SLOT).length !== 2) throw new Error(`ad-check.${version}.md 에 ${KNOWLEDGE_SLOT} 자리가 정확히 하나여야 함`);

  const files = readdirSync(KNOWLEDGE_DIR)
    .filter((f) => /^0\d-.*\.md$/.test(f))
    .sort();
  if (files.length !== 6) throw new Error(`knowledge/yakkiho 파일이 6개가 아님: ${files.length}개`);
  const knowledge = files.map((f) => readFileSync(path.join(KNOWLEDGE_DIR, f), "utf-8").trim()).join("\n\n");
  return body.replace(KNOWLEDGE_SLOT, () => knowledge);
}

/** user 메시지: 제품·사용처·번호 붙은 줄. 매번 바뀌므로 맨 뒤에 둔다 */
export function buildUserMessage(product: LabProduct, usage: z.infer<typeof AdUsage>, lines: string[]): string {
  const category = product.product_category ?? "미정";
  const ingredients = product.ingredients.map((i) => `${i.ko}(${i.ja})`).join(", ");
  const numbered = lines.map((line, i) => `${i + 1}: ${line}`).join("\n");
  return `[제품]\n이름: ${product.name_ko}\n제품 구분: ${category}\n전성분: ${ingredients}\n\n[사용처]\n${usage}\n\n[문구]\n${numbered}`;
}

// ---------- 모델 출력 (v1·v2 모두 읽는 느슨한 모양) ----------

const RawSuggestion = z.object({ text: z.string(), recheck: SuggestionRecheck.shape.recheck, recheck_reason: z.string() });
const RawFinding = z.object({
  text: z.string().min(1),
  start: z.number().int().nonnegative().optional(),
  end: z.number().int().nonnegative().optional(),
  risk: Risk.optional(),
  action: AdAction.exclude(["ok"]),
  reason: z.string(),
  basis: z.string(),
  basis_status: BasisStatus,
  suggestions: z.array(RawSuggestion),
});
const RawLine = z.object({
  line_index: z.number().int().positive(),
  original: z.string().optional(), // v1 만 준다. v2 는 코드가 붙인다
  action: AdAction,
  ingredient_check: z.string().optional(),
  translated_text: z.string().nullable().optional(),
  back_translation_ko: z.string().nullable().optional(),
  localized_note: z.string().optional(),
  findings: z.array(RawFinding),
});
const RawResult = z.object({
  overall_action: AdAction,
  overall_risk: Risk,
  lines: z.array(RawLine),
});
type RawLine = z.infer<typeof RawLine>;

/** 줄 하나의 판정 (캐시에 저장하는 모양). line_index 는 요청마다 달라 저장하지 않는다 */
export const JudgedLine = z.object({
  action: AdAction,
  ingredient_check: z.string(),
  translated_text: z.string().nullable(),
  back_translation_ko: z.string().nullable(),
  localized_note: z.string(),
  findings: z.array(AdFinding.omit({ line_index: true })),
});
export type JudgedLine = z.infer<typeof JudgedLine>;

/** 모델 출력 한 줄 → 공용 스키마 모양. 위치(start/end)는 text 로 코드가 계산하고, 못 찾으면 경고 */
function toJudgedLine(raw: RawLine, original: string, warnings: string[]): JudgedLine {
  const findings = raw.findings.map((f) => {
    let start: number | undefined;
    let end: number | undefined;
    const at = original.indexOf(f.text);
    if (at >= 0) {
      start = at;
      end = at + f.text.length;
    } else {
      warnings.push(`줄 ${raw.line_index}: 위반 구간 「${f.text}」이 원문에 없음`);
    }
    return {
      text: f.text,
      risk: f.risk ?? RISK_BY_ACTION[f.action],
      reason: f.reason,
      basis: f.basis,
      suggestions: f.suggestions.map((s) => s.text),
      start,
      end,
      action: f.action,
      basis_status: f.basis_status,
      suggestion_rechecks: f.suggestions,
    };
  });
  return {
    action: raw.action,
    ingredient_check: raw.ingredient_check ?? "",
    translated_text: raw.translated_text ?? null,
    back_translation_ko: raw.back_translation_ko ?? null,
    localized_note: raw.localized_note ?? "",
    findings,
  };
}

// ---------- 모델 호출 ----------

export type Usage = { input: number; cached: number; output: number };

const ChatResponse = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
  usage: z.object({
    prompt_tokens: z.number(),
    completion_tokens: z.number(),
    prompt_tokens_details: z.object({ cached_tokens: z.number().optional() }).optional(),
  }),
});

export type ModelReply = { text: string; usage: Usage };

/** OpenAI Chat Completions 를 fetch 로 부른다. 키는 환경 변수에서만 읽는다. Claude 로 바꿀 때는 이 함수만 교체 */
export async function callModel(model: string, system: string, user: string): Promise<ModelReply> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY 환경 변수가 없음");
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      ...(/^gpt-4/.test(model) ? { temperature: 0 } : {}),
    }),
  });
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message = z.object({ error: z.object({ message: z.string() }) }).safeParse(json);
    throw new Error(`OpenAI ${res.status}: ${message.success ? message.data.error.message : "응답 해석 실패"}`);
  }
  const parsed = ChatResponse.parse(json);
  return {
    text: parsed.choices[0].message.content ?? "",
    usage: {
      input: parsed.usage.prompt_tokens,
      cached: parsed.usage.prompt_tokens_details?.cached_tokens ?? 0,
      output: parsed.usage.completion_tokens,
    },
  };
}

function addUsage(a: Usage, b: Usage): Usage {
  return { input: a.input + b.input, cached: a.cached + b.cached, output: a.output + b.output };
}

// ---------- 한 요청 (최대 20줄) ----------

export type RequestResult = {
  lines: JudgedLine[]; // 요청한 줄 순서 그대로
  usage: Usage; // 재시도 포함 합계
  attempts: number;
  warnings: string[];
};

export type JudgeRequest = {
  model: string;
  version: string;
  system: string;
  product: LabProduct;
  usage: z.infer<typeof AdUsage>;
  lines: string[];
};

/** 한 요청으로 여러 줄을 판정한다. 검증 실패 시 1회 재시도 (CLAUDE.md 7장 1번) */
export async function judgeRequest(req: JudgeRequest): Promise<RequestResult> {
  if (req.lines.length === 0 || req.lines.length > MAX_LINES) throw new Error(`한 요청은 1~${MAX_LINES}줄: ${req.lines.length}줄`);
  const user = buildUserMessage(req.product, req.usage, req.lines);
  let total: Usage = { input: 0, cached: 0, output: 0 };
  let lastError = "";

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const reply = await callModel(req.model, req.system, user);
    total = addUsage(total, reply.usage);
    try {
      const raw = RawResult.parse(JSON.parse(reply.text));
      const byIndex = new Map(raw.lines.map((l) => [l.line_index, l]));
      const warnings: string[] = [];
      const lines = req.lines.map((original, i) => {
        const found = byIndex.get(i + 1);
        if (!found) throw new Error(`줄 ${i + 1} 판정이 빠짐`);
        return toJudgedLine(found, original, warnings);
      });
      const overall = worstAction(lines.map((l) => l.action));
      if (overall !== raw.overall_action) warnings.push(`overall_action 불일치: 모델 ${raw.overall_action}, 줄 기준 ${overall}`);
      return { lines, usage: total, attempts: attempt, warnings };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(`검증 실패(재시도 후): ${lastError}`);
}
