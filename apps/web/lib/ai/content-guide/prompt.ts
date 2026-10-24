// 콘텐츠 제작 가이드 프롬프트 조립. system = 공통 앞부분 + 단계 파일, user = 입력 블록 (+ 고른 제목).
// 공통 앞부분(역할·규칙 문서·약기법 자료)이 두 단계에서 똑같아서 두 번째 호출부터 입력 캐시가 먹는다.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ContentGuideInput, GuideTitle } from "@/lib/schemas/content-guide";

const PROMPT_MARKER = "=== PROMPT START ===";
const PROMPTS_DIR = path.join(process.cwd(), "prompts");
// 서버는 apps/web 에서 실행한다고 가정한다. 기준 자료(knowledge/)는 저장소 루트에 있다
const KNOWLEDGE_ROOT = path.join(process.cwd(), "..", "..", "knowledge");

export type GuideStep = "titles" | "body";

function promptBody(file: string): string {
  const raw = readFileSync(path.join(PROMPTS_DIR, file), "utf-8");
  const at = raw.indexOf(PROMPT_MARKER);
  if (at < 0) throw new Error(`${file} 에 ${PROMPT_MARKER} 줄이 없음`);
  return raw.slice(at + PROMPT_MARKER.length).trim();
}

/** knowledge/<폴더>/ 의 00~ 파일을 순서대로 이어 붙인다 */
function knowledge(folder: string, expected: number): string {
  const dir = path.join(KNOWLEDGE_ROOT, folder);
  const files = readdirSync(dir)
    .filter((f) => /^0\d-.*\.md$/.test(f))
    .sort();
  if (files.length !== expected) throw new Error(`knowledge/${folder} 파일이 ${expected}개가 아님: ${files.length}개`);
  return files.map((f) => readFileSync(path.join(dir, f), "utf-8").trim()).join("\n\n");
}

export function buildSystemPrompt(step: GuideStep, version: string): string {
  if (!/^v\d+$/.test(version)) throw new Error(`프롬프트 버전 이름이 올바르지 않음: ${version}`);
  const common = promptBody(`content-guide-common.${version}.md`)
    .replace("{{RULES}}", () => knowledge("content-guide", 5))
    .replace("{{YAKKIHO}}", () => knowledge("yakkiho", 6));
  return `${common}\n\n${promptBody(`content-guide-${step}.${version}.md`)}`;
}

const list = (items: string[]) => (items.length ? items.join(", ") : "없음");

/** 프롬프트 2장 입력 블록. 매번 바뀌므로 user 메시지로 맨 뒤에 둔다 */
export function buildUserMessage(input: ContentGuideInput, picked?: GuideTitle): string {
  const p = input.product;
  const reviews = p.launch_status === "developing";
  const parts = [
    `[제품]\n이름: ${p.name}\n일본어 이름: ${p.name_ja}\n종류: ${p.kind}\n제품 구분: ${p.category ?? "미정"}\n출시 상태: ${p.launch_status === "live" ? "launched" : "developing"}\n가격: ${p.price_jpy ? `${p.price_jpy}円` : "미정"}\n용량: ${p.volume}\n전성분(일본어): ${p.ingredients_ja.join(", ")}\n같은 라인 출시 제품: ${list(p.line_products)}`,
    reviews
      ? "[리뷰 소구점]\n없음"
      : `[리뷰 소구점]\n우리 칭찬 많은 주제(많은 순): ${list(input.appeals.praised)}\n경쟁 제품 불만 많은 주제(많은 순): ${list(input.appeals.competitor_complaints)}\n소구점 후보: ${list(input.appeals.candidates)}`,
    `[시장 키워드]\n검색어(많은 순): ${list(input.keywords.search)}\n관심 성분(많은 순): ${list(input.keywords.ingredients)}`,
    `[리뷰 원문]\n${input.review_quotes.length ? input.review_quotes.map((q, i) => `${i + 1}. ${q}`).join("\n") : "없음"}`,
    `[근거 자료]\n${input.evidence.length ? input.evidence.join("\n") : "없음"}`,
    `[행사]\n${input.promo ?? "없음"}`,
    `[요청]\n채널: ${input.channel}\n게시물 종류: ${input.post_type}\n시즌: ${input.season ?? "없음"}\n사진 장수: ${input.slide_count}\n협찬 게시물: ${input.sponsored ? "예" : "아니오"}`,
    `[강조할 방향]\n${input.direction.trim() || "없음"}`,
  ];
  if (picked) parts.push(`[고른 제목]\n일본어: ${picked.title_ja}\n한국어: ${picked.title_ko}\n각도: ${picked.angle}`);
  return parts.join("\n\n");
}
