// GEO가 질문하는 AI 검색 엔진 어댑터. 소비자처럼 질문만 보내고(지시문·제품 정보 없음), 답변 원문과 API의 인용 칸을 받는다
// 위치는 일본으로 고정한다. Gemini·Perplexity는 키가 준비되면 같은 모양으로 붙인다
import type Anthropic from "@anthropic-ai/sdk";
import type { GeoEngine } from "@/lib/schemas/geo";
import { getAnthropic, hasAnthropicKey } from "../anthropic";
import { GEO_ENGINE_MODELS } from "../config";
import { AiConfigError, getOpenAI } from "../openai";

export type EngineAnswer = { answer: string; citations: { url: string; title: string | null }[] };

export type GeoEngineAdapter = {
  engine: GeoEngine;
  model: string;
  available: () => boolean;
  ask: (query: string) => Promise<EngineAnswer>;
};

const JAPAN = { type: "approximate" as const, country: "JP", timezone: "Asia/Tokyo" };
const MAX_PAUSE_RESUMES = 3;

function dedupe(citations: EngineAnswer["citations"]) {
  return [...new Map(citations.map((c) => [c.url, c])).values()];
}

const chatgpt: GeoEngineAdapter = {
  engine: "chatgpt",
  model: GEO_ENGINE_MODELS.chatgpt,
  available: () => Boolean(process.env.OPENAI_API_KEY),
  async ask(query) {
    const res = await getOpenAI().responses.create({
      model: GEO_ENGINE_MODELS.chatgpt,
      tools: [{ type: "web_search", user_location: JAPAN }],
      // 소비자용 ChatGPT처럼 검색을 거친 답을 받는다 (auto면 검색 없이 기억으로 답해 인용이 비고, 없는 제품이 섞였다)
      tool_choice: "required",
      input: query,
    });
    const citations: EngineAnswer["citations"] = [];
    for (const item of res.output) {
      if (item.type !== "message") continue;
      for (const part of item.content) {
        if (part.type !== "output_text") continue;
        for (const a of part.annotations) if (a.type === "url_citation") citations.push({ url: a.url, title: a.title || null });
      }
    }
    return { answer: res.output_text, citations: dedupe(citations) };
  },
};

const claude: GeoEngineAdapter = {
  engine: "claude",
  model: GEO_ENGINE_MODELS.claude,
  available: hasAnthropicKey,
  async ask(query) {
    const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: query }];
    let res = await create(messages);
    // 서버 쪽 검색이 길어지면 pause_turn으로 멈춘다. 받은 내용을 그대로 붙여 다시 보내면 이어서 답한다
    for (let i = 0; res.stop_reason === "pause_turn" && i < MAX_PAUSE_RESUMES; i++) {
      messages.push({ role: "assistant", content: res.content });
      res = await create(messages);
    }
    if (res.stop_reason === "refusal") throw new Error("Claude가 이 질문에 답하지 않았어요 (refusal)");
    const citations: EngineAnswer["citations"] = [];
    const text: string[] = [];
    for (const block of res.content) {
      if (block.type !== "text") continue;
      text.push(block.text);
      for (const c of block.citations ?? []) if (c.type === "web_search_result_location") citations.push({ url: c.url, title: c.title });
    }
    return { answer: text.join(""), citations: dedupe(citations) };
  },
};

// 정책상 답을 거절하면 서버가 다른 모델로 이어서 답한다 (server-side fallback)
function create(messages: Anthropic.Beta.BetaMessageParam[]) {
  return getAnthropic().beta.messages.create({
    model: GEO_ENGINE_MODELS.claude,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5, user_location: JAPAN }],
    messages,
  });
}

function pending(engine: GeoEngine): GeoEngineAdapter {
  return {
    engine,
    model: "-",
    available: () => false,
    ask: async () => {
      throw new AiConfigError(`${engine} 엔진은 아직 연결하지 않았어요 (키 준비 후 추가)`);
    },
  };
}

export const GEO_ENGINES: Record<GeoEngine, GeoEngineAdapter> = {
  chatgpt,
  claude,
  gemini: pending("gemini"),
  perplexity: pending("perplexity"),
};
