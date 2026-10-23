// 등급(precise·bulk)만 받아 AI_PROVIDER의 모델로 JSON 스키마 고정 출력을 받는 함수 하나 (CLAUDE.md 2장·7장)
// Zod로 검증하고 실패하면 1회 재시도. 둘 다 실패하면 null
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { zodResponseFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { getAnthropic } from "./anthropic";
import { aiModel, aiProvider, type AiTier } from "./config";
import { getOpenAI } from "./openai";

export async function structuredCall<T extends z.ZodType>(opts: {
  tier: AiTier;
  system: string;
  user: string;
  schema: T;
  name: string;
}): Promise<{ data: z.infer<T>; model: string } | null> {
  const model = aiModel(opts.tier);
  const once = async (): Promise<z.infer<T> | null> => {
    let raw: unknown;
    if (aiProvider() === "anthropic") {
      const res = await getAnthropic().messages.parse({
        model,
        max_tokens: 4000,
        system: opts.system,
        messages: [{ role: "user", content: opts.user }],
        output_config: { format: zodOutputFormat(opts.schema) },
      });
      if (res.stop_reason === "refusal") return null;
      raw = res.parsed_output;
    } else {
      const res = await getOpenAI().chat.completions.parse({
        model,
        temperature: 0,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        response_format: zodResponseFormat(opts.schema, opts.name),
      });
      const message = res.choices[0]?.message;
      if (!message || message.refusal) return null;
      raw = message.parsed;
    }
    const checked = opts.schema.safeParse(raw);
    return checked.success ? checked.data : null;
  };
  const data = (await once()) ?? (await once());
  return data === null ? null : { data, model };
}
