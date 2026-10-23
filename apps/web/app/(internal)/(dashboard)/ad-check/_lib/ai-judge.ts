"use server";
// 화면에서 부르는 AI 판정 (연습장 전용 서버 액션). 서버에서만 실행되고, OPENAI_API_KEY 는 여기서만 읽는다.
// 화면으로 돌려주는 것은 판정 결과와 토큰 숫자뿐이다. 키·환경 변수·요청 원문·OpenAI 오류 원문은 돌려주지 않는다.
// 정식 구현 때는 POST /api/ad-check 와 lib/ai/ 로 옮긴다 (CLAUDE.md 6장).
import { z } from "zod";
import { AdUsage } from "@/lib/schemas/ad-check";
import { WORKSPACE_ID } from "@/lib/mock/helpers";
import { buildAiAdCheck, type AiJudgeResult } from "./ai-check";
import { getLabProducts } from "./data";
import { cacheKey, readCachedLine, writeCachedLine } from "./lab-cache";
import { splitInput } from "./judge";
import { buildSystemPrompt, judgeRequest, type JudgedLine, type Usage } from "./prompt-lab";

const MAX_TEXT_CHARS = 4000;
const DEFAULT_MODEL = "gpt-4.1-mini";
const DEFAULT_VERSION = "v2";

const Input = z.object({
  productId: z.string().min(1).max(64),
  usage: AdUsage,
  text: z.string().min(1).max(MAX_TEXT_CHARS),
});

// 서버 터미널에 남기는 로그에서도 키처럼 보이는 문자열은 가린다
function redact(message: string): string {
  return message.replace(/sk-[A-Za-z0-9_\-*.]+/g, "sk-***");
}

/** 화면에 보여 줄 오류는 이 안에서만 고른다 (원문 메시지는 화면으로 보내지 않는다) */
function safeError(e: unknown): string {
  const message = e instanceof Error ? e.message : "";
  console.error(`[ad-check AI] ${redact(message)}`);
  if (message.includes("OPENAI_API_KEY")) return "서버에 API 키가 설정되어 있지 않습니다";
  const code = /^OpenAI (\d{3})/.exec(message)?.[1];
  if (code === "401") return "AI 호출 실패 (코드 401): API 키를 확인해 주세요";
  if (code === "429") return "AI 호출 실패 (코드 429): 잠시 후 다시 시도해 주세요";
  if (code) return `AI 호출 실패 (코드 ${code})`;
  if (message.startsWith("검증 실패")) return "AI 응답 형식이 맞지 않아 판정하지 못했습니다";
  return "AI 판정에 실패했습니다";
}

export async function judgeWithAi(input: unknown): Promise<AiJudgeResult> {
  // 화면에서 숨기는 것만으로는 부족하다. 서버에서도 같은 변수를 확인해 막는다
  if (process.env.AD_CHECK_LAB_AI !== "1") return { ok: false, error: "AI 판정이 꺼져 있습니다" };

  const parsed = Input.safeParse(input);
  if (!parsed.success) return { ok: false, error: "입력이 올바르지 않습니다" };

  try {
    const { productId, usage, text } = parsed.data;
    const product = (await getLabProducts()).find((p) => p.id === productId);
    if (!product) return { ok: false, error: "알 수 없는 제품입니다" };
    const lines = splitInput(text);
    if (lines.length === 0) return { ok: false, error: "검토할 문구가 없습니다" };

    const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
    const rawVersion = process.env.AD_CHECK_PROMPT_VERSION || DEFAULT_VERSION;
    const version = /^v\d+$/.test(rawVersion) ? rawVersion : DEFAULT_VERSION;

    // 같은 줄·제품·사용처·버전·모델이면 저장된 결과를 쓰고, 없는 줄만 한 번에 보낸다
    const judged: (JudgedLine | null)[] = lines.map((line) => readCachedLine(cacheKey({ line, product, usage, version, model })));
    const pendingIdx = judged.flatMap((j, i) => (j === null ? [i] : []));
    let tokens: Usage = { input: 0, cached: 0, output: 0 };

    if (pendingIdx.length > 0) {
      const result = await judgeRequest({ model, version, system: buildSystemPrompt(version), product, usage, lines: pendingIdx.map((i) => lines[i]) });
      tokens = result.usage;
      pendingIdx.forEach((lineIdx, k) => {
        judged[lineIdx] = result.lines[k];
        writeCachedLine(cacheKey({ line: lines[lineIdx], product, usage, version, model }), result.lines[k]);
      });
    }

    const complete = judged.filter((j): j is JudgedLine => j !== null);
    if (complete.length !== lines.length) return { ok: false, error: "AI 판정에 실패했습니다" };

    const check = buildAiAdCheck({
      id: "draft-ai",
      workspaceId: WORKSPACE_ID,
      createdAt: new Date().toISOString(),
      lines,
      judged: complete,
      productId,
      usage,
      model,
      promptVersion: `ad-check.${version}`,
    });
    return {
      ok: true,
      check,
      meta: { model, promptVersion: `ad-check.${version}`, usage: tokens, sentLines: pendingIdx.length, cachedLines: lines.length - pendingIdx.length },
    };
  } catch (e) {
    return { ok: false, error: safeError(e) };
  }
}
