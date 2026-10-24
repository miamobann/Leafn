// 만든 일본어 문구를 광고 검토 판정(ad-check v5)에 한 번 더 통과시킨다. 약기법이 항상 먼저라서, 제작 결과도 판정을 거친다.
// 블록마다 첫 번째 안(가장 추천)만 본다. 줄 수가 많으면 판정 한도(MAX_LINES)씩 나눠 부른다.
import { MAX_LINES } from "@/lib/ai/ad-check/action";
import { judgeLines } from "@/lib/ai/ad-check/judge";
import type { AiReply, AiRequest, AiUsage } from "@/lib/ai/client";
import type { AdUsage } from "@/lib/schemas/ad-check";
import type { AdCheckProductInput, JudgedLine } from "@/lib/schemas/ad-check-ai";
import type { ContentChannel, GuideBodyResult } from "@/lib/schemas/content-guide";
import type { z } from "zod";

const USAGE: Record<ContentChannel, z.infer<typeof AdUsage>> = { qoo10_detail: "detail_page", instagram: "sns", x: "sns", banner: "banner" };

export type BlockCheck = { key: string; line: JudgedLine };
export type BodyCheck = { blocks: BlockCheck[]; usage: AiUsage; model: string | null; promptVersion: string | null };

type Deps = { call?: (request: AiRequest) => Promise<AiReply> };

export async function checkBody(channel: ContentChannel, product: AdCheckProductInput, body: GuideBodyResult, deps: Deps = {}): Promise<BodyCheck> {
  // 판정은 한 줄 = 한 문구라서, 여러 줄인 문구는 줄바꿈을 「 / 」로 이어 한 줄로 보낸다
  const targets = body.blocks.flatMap((b) => {
    const text = b.options[0]?.text_ja.trim() ?? "";
    return text && !b.needs_evidence ? [{ key: b.key, text: text.replace(/\n+/g, " / ") }] : [];
  });
  const usage: AiUsage = { input: 0, cached: 0, output: 0 };
  const blocks: BlockCheck[] = [];
  let model: string | null = null;
  let promptVersion: string | null = null;
  for (let i = 0; i < targets.length; i += MAX_LINES) {
    const chunk = targets.slice(i, i + MAX_LINES);
    const judged = await judgeLines({ product, usage: USAGE[channel], lines: chunk.map((t) => t.text) }, deps);
    usage.input += judged.usage.input;
    usage.cached += judged.usage.cached;
    usage.output += judged.usage.output;
    model = judged.model;
    promptVersion = judged.promptVersion;
    judged.lines.forEach((line, j) => blocks.push({ key: chunk[j]!.key, line }));
  }
  return { blocks, usage, model, promptVersion };
}
