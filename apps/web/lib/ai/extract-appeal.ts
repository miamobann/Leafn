// 랭킹 상품 이미지 → 소구 성분·피부 고민·프로모션. callAi(대량 등급, 이미지 입력 + JSON 스키마 출력)로 부른다
// 응답은 Zod로 검증하고 실패하면 1회 재시도 (CLAUDE.md 7장). 근거 대조와 성분 이름 통일은 appeal-normalize.ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { AppealAiOutput, type AppealAnalysis, type RankingSourceItem } from "@/lib/schemas/trend";
import { verifyAppeal } from "./appeal-normalize";
import { callAi } from "./client";
import { loadPrompt } from "./prompts";

const MAX_IMAGES = 4;
const PUBLIC_DIR = path.join(process.cwd(), "public");
const MIME: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };

/** https URL은 그대로, public/ 아래 경로는 data URL로 (localhost URL은 AI 제공사가 받을 수 없다) */
async function toImageUrl(src: string): Promise<string> {
  if (/^https?:\/\//.test(src)) return src;
  const file = path.normalize(path.join(PUBLIC_DIR, src));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) throw new Error(`public 폴더 밖의 이미지 경로는 쓸 수 없어요: ${src}`);
  const mime = MIME[path.extname(file).toLowerCase()];
  if (!mime) throw new Error(`지원하지 않는 이미지 형식이에요: ${src}`);
  return `data:${mime};base64,${(await readFile(file)).toString("base64")}`;
}

/** callAi 응답(text)을 스키마로 검증. 형식이 틀리면 null */
function parseOutput(text: string): AppealAiOutput | null {
  try {
    const checked = AppealAiOutput.safeParse(JSON.parse(text));
    return checked.success ? checked.data : null;
  } catch {
    return null;
  }
}

export async function extractAppeal(item: RankingSourceItem): Promise<AppealAnalysis> {
  const { text: system, version } = await loadPrompt("appeal-extract", 1);
  const images = await Promise.all(item.image_urls.slice(0, MAX_IMAGES).map(toImageUrl));
  const request = () =>
    callAi({
      grade: "bulk",
      system,
      user: JSON.stringify({ brand: item.brand, name: item.name, price_jpy: item.price_jpy, review_count: item.review_count }),
      images,
      schema: { name: "appeal_extraction", zod: AppealAiOutput },
    });
  let reply = await request();
  let output = parseOutput(reply.text);
  if (!output) {
    reply = await request();
    output = parseOutput(reply.text);
  }
  if (!output) throw new Error(`이미지 분석 응답이 형식에 맞지 않아요 (${item.brand} ${item.name})`);
  return { ...verifyAppeal(output, item.page_text), model: reply.model, prompt_version: version, analyzed_at: new Date().toISOString() };
}
