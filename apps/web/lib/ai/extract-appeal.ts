// 랭킹 상품 이미지 → 소구 성분·피부 고민·프로모션 (OpenAI Vision, JSON 스키마 고정 출력)
// 응답은 Zod로 검증하고 실패하면 1회 재시도 (CLAUDE.md 7장). 근거 대조와 성분 이름 통일은 appeal-normalize.ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { zodResponseFormat } from "openai/helpers/zod";
import { AppealAiOutput, type AppealAnalysis, type RankingSourceItem } from "@/lib/schemas/trend";
import { verifyAppeal } from "./appeal-normalize";
import { AI_MODELS, getOpenAI } from "./openai";
import { loadPrompt } from "./prompts";

const MAX_IMAGES = 4;
const PUBLIC_DIR = path.join(process.cwd(), "public");
const MIME: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };

/** https URL은 그대로, public/ 아래 경로는 data URL로 (localhost URL은 OpenAI가 받을 수 없다) */
async function toImageUrl(src: string): Promise<string> {
  if (/^https?:\/\//.test(src)) return src;
  const file = path.normalize(path.join(PUBLIC_DIR, src));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) throw new Error(`public 폴더 밖의 이미지 경로는 쓸 수 없어요: ${src}`);
  const mime = MIME[path.extname(file).toLowerCase()];
  if (!mime) throw new Error(`지원하지 않는 이미지 형식이에요: ${src}`);
  return `data:${mime};base64,${(await readFile(file)).toString("base64")}`;
}

async function requestOnce(item: RankingSourceItem, system: string, imageUrls: string[]): Promise<AppealAiOutput | null> {
  const completion = await getOpenAI().chat.completions.parse({
    model: AI_MODELS.vision,
    temperature: 0,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          { type: "text", text: JSON.stringify({ brand: item.brand, name: item.name, price_jpy: item.price_jpy, review_count: item.review_count }) },
          ...imageUrls.map((url) => ({ type: "image_url" as const, image_url: { url, detail: "high" as const } })),
        ],
      },
    ],
    response_format: zodResponseFormat(AppealAiOutput, "appeal_extraction"),
  });
  const message = completion.choices[0]?.message;
  if (!message || message.refusal) return null;
  const checked = AppealAiOutput.safeParse(message.parsed);
  return checked.success ? checked.data : null;
}

export async function extractAppeal(item: RankingSourceItem): Promise<AppealAnalysis> {
  const { text: system, version } = await loadPrompt("appeal-extract", 1);
  const imageUrls = await Promise.all(item.image_urls.slice(0, MAX_IMAGES).map(toImageUrl));
  const output = (await requestOnce(item, system, imageUrls)) ?? (await requestOnce(item, system, imageUrls));
  if (!output) throw new Error(`이미지 분석 응답이 형식에 맞지 않아요 (${item.brand} ${item.name})`);
  return { ...verifyAppeal(output, item.page_text), model: AI_MODELS.vision, prompt_version: version, analyzed_at: new Date().toISOString() };
}
