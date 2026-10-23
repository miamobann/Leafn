import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { z } from "zod";
import type { AdUsage } from "@/lib/schemas/ad-check";
import type { AdCheckProductInput } from "@/lib/schemas/ad-check-ai";

const PROMPT_MARKER = "=== PROMPT START ===";
const KNOWLEDGE_SLOT = "{{KNOWLEDGE}}";

// 서버는 apps/web 에서 실행한다고 가정한다. 기준 자료(knowledge/)는 저장소 루트에 있다
const PROMPTS_DIR = path.join(process.cwd(), "prompts");
const KNOWLEDGE_DIR = path.join(process.cwd(), "..", "..", "knowledge", "yakkiho");
const KNOWLEDGE_FILE_COUNT = 6;

/**
 * prompts/ad-check.<version>.md 에서 머리말을 떼고, {{KNOWLEDGE}} 자리에 기준 자료 6개(00~05)를 이어 붙인다.
 * 고정 내용이라 모든 요청에서 똑같다. 그래서 system 메시지로 맨 앞에 보내면 앞부분 캐시가 먹는다.
 */
export function buildSystemPrompt(version: string): string {
  // 버전 이름이 파일 경로가 되므로 v4 같은 모양만 허용한다
  if (!/^v\d+$/.test(version)) throw new Error(`프롬프트 버전 이름이 올바르지 않음: ${version}`);

  const raw = readFileSync(path.join(PROMPTS_DIR, `ad-check.${version}.md`), "utf-8");
  const at = raw.indexOf(PROMPT_MARKER);
  if (at < 0) throw new Error(`ad-check.${version}.md 에 ${PROMPT_MARKER} 줄이 없음`);
  const body = raw.slice(at + PROMPT_MARKER.length).trim();
  if (body.split(KNOWLEDGE_SLOT).length !== 2) throw new Error(`ad-check.${version}.md 에 ${KNOWLEDGE_SLOT} 자리가 정확히 하나여야 함`);

  const files = readdirSync(KNOWLEDGE_DIR)
    .filter((f) => /^0\d-.*\.md$/.test(f))
    .sort();
  if (files.length !== KNOWLEDGE_FILE_COUNT) throw new Error(`knowledge/yakkiho 파일이 ${KNOWLEDGE_FILE_COUNT}개가 아님: ${files.length}개`);
  const knowledge = files.map((f) => readFileSync(path.join(KNOWLEDGE_DIR, f), "utf-8").trim()).join("\n\n");
  return body.replace(KNOWLEDGE_SLOT, () => knowledge);
}

/** user 메시지: 제품·사용처·번호 붙은 줄(프롬프트 2장 형식). 매번 바뀌므로 맨 뒤에 둔다 */
export function buildUserMessage(product: AdCheckProductInput, usage: z.infer<typeof AdUsage>, lines: string[]): string {
  const category = product.product_category ?? "미정";
  const numbered = lines.map((line, i) => `${i + 1}: ${line}`).join("\n");
  return `[제품]\n이름: ${product.name}\n제품 구분: ${category}\n전성분: ${product.ingredients.join(", ")}\n\n[사용처]\n${usage}\n\n[문구]\n${numbered}`;
}
