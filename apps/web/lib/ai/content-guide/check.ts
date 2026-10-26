// 만든 일본어 문구를 광고 검토 판정(ad-check 판정, 기본 버전은 judge.ts의 AD_CHECK_PROMPT_VERSION)에 한 번 더 통과시킨다. 약기법이 항상 먼저라서, 제작 결과도 판정을 거친다.
// 블록마다 첫 번째 안(가장 추천)만 본다. 줄 수가 많으면 판정 한도(MAX_LINES)씩 나눠 부른다.
import { MAX_LINES } from "@/lib/ai/ad-check/action";
import { judgeLines } from "@/lib/ai/ad-check/judge";
import type { AiReply, AiRequest, AiUsage } from "@/lib/ai/client";
import type { AdUsage } from "@/lib/schemas/ad-check";
import type { AdCheckProductInput, JudgedLine } from "@/lib/schemas/ad-check-ai";
import type { ContentChannel, GuideBodyResult } from "@/lib/schemas/content-guide";
import type { z } from "zod";

const USAGE: Record<ContentChannel, z.infer<typeof AdUsage>> = { qoo10_detail: "detail_page", instagram: "sns", x: "sns", banner: "banner" };

/** 해시태그 판정 줄의 키 (본문 블록 키와 겹치지 않게) */
export const HASHTAG_KEY = "hashtags";
/** 제목(큐텐 상품명 · SNS 첫 줄) 판정 키. 검색 결과에 가장 먼저 보이는 광고 문구라 같이 판정한다 (2026-10-26) */
export const TITLE_KEY = "title";

/** text = 판정에 보낸 한 줄 (ad_check_lines.original 로 저장) */
export type BlockCheck = { key: string; text: string; line: JudgedLine };
export type BodyCheck = { blocks: BlockCheck[]; adUsage: z.infer<typeof AdUsage>; usage: AiUsage; model: string | null; promptVersion: string | null };

type Deps = { call?: (request: AiRequest) => Promise<AiReply> };

export async function checkBody(channel: ContentChannel, product: AdCheckProductInput, body: GuideBodyResult, deps: Deps = {}, title?: string): Promise<BodyCheck> {
  // 판정은 한 줄 = 한 문구라서, 여러 줄인 문구는 줄바꿈을 「 / 」로 이어 한 줄로 보낸다
  const targets = body.blocks.flatMap((b) => {
    const text = b.options[0]?.text_ja.trim() ?? "";
    return text && !b.needs_evidence ? [{ key: b.key, text: text.replace(/\n+/g, " / ") }] : [];
  });
  if (title?.trim()) targets.unshift({ key: TITLE_KEY, text: title.trim().replace(/\n+/g, " / ") });
  // 해시태그도 광고 표시라 같은 판정을 거친다 (트렌드 검색어가 들어가는 곳, 2026-10-25). 판정 키는 HASHTAG_KEY
  const tags = [...body.hashtags.brand, ...body.hashtags.ingredient, ...body.hashtags.trend].map((t) => t.trim()).filter(Boolean);
  if (tags.length) targets.push({ key: HASHTAG_KEY, text: tags.join(" ") });
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
    judged.lines.forEach((line, j) => blocks.push({ key: chunk[j]!.key, text: chunk[j]!.text, line }));
  }
  return { blocks, adUsage: USAGE[channel], usage, model, promptVersion };
}

/** 약기법에 걸린 해시태그는 빼고 저장한다 (2026-10-27 TAB 3: 해시태그는 「가이드에 반영」으로 고칠 수 없어 아예 보이지 않게).
 *  금지어 검사(lintHits)와 판정 findings 가 짚은 말이 든 태그만 뺀다. 짚은 말을 태그에서 못 찾으면 아무것도 빼지 않고 경고를 그대로 남긴다 (약기법 우선).
 *  뺐으면 남은 태그만 다시 판정해 해시태그 판정 줄을 바꾼다 (판정 기록을 손으로 고치지 않는다). 다시 걸리면 경고가 그대로 보인다 */
export async function dropFlaggedHashtags<H extends { key: string; text: string }>(
  channel: ContentChannel,
  product: AdCheckProductInput,
  body: GuideBodyResult,
  lintHits: H[],
  checked: BodyCheck,
  deps: Deps = {},
): Promise<{ body: GuideBodyResult; lintHits: H[]; checked: BodyCheck }> {
  const tagLine = checked.blocks.find((b) => b.key === HASHTAG_KEY);
  const words = [
    ...lintHits.filter((h) => h.key === HASHTAG_KEY).map((h) => h.text),
    ...(tagLine && tagLine.line.action !== "ok" ? tagLine.line.findings.map((f) => f.text) : []),
  ]
    .map((w) => w.replace(/^#/, "").trim())
    .filter(Boolean);
  const all = [...body.hashtags.brand, ...body.hashtags.ingredient, ...body.hashtags.trend];
  // 짚은 말마다 그 말이 든 태그가 있어야 뺀다 (판정이 태그 밖의 말을 짚었으면 그대로 둔다)
  if (words.length === 0 || !words.every((w) => all.some((t) => t.includes(w)))) return { body, lintHits, checked };
  const keep = (tags: string[]) => tags.filter((t) => !words.some((w) => t.includes(w)));
  const hashtags = { brand: keep(body.hashtags.brand), ingredient: keep(body.hashtags.ingredient), trend: keep(body.hashtags.trend) };
  const left = [...hashtags.brand, ...hashtags.ingredient, ...hashtags.trend];
  const others = checked.blocks.filter((b) => b.key !== HASHTAG_KEY);
  const usage = { ...checked.usage };
  let blocks = others;
  if (left.length) {
    const text = left.join(" ");
    const judged = await judgeLines({ product, usage: USAGE[channel], lines: [text] }, deps);
    usage.input += judged.usage.input;
    usage.cached += judged.usage.cached;
    usage.output += judged.usage.output;
    blocks = [...others, { key: HASHTAG_KEY, text, line: judged.lines[0]! }];
  }
  return { body: { ...body, hashtags }, lintHits: lintHits.filter((h) => h.key !== HASHTAG_KEY), checked: { ...checked, blocks, usage } };
}
