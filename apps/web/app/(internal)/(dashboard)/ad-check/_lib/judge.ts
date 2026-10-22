// 프로토타입용 "검토 엔진". 입력한 줄이 샘플 문구와 같으면 그 샘플 판정을 쓰고,
// 아니면 "전문가 확인"으로 둔다. 실제 AI 연결 때 이 파일을 lib/ai/ 호출로 바꾼다.
// 결과는 공용 Zod 스키마(lib/schemas/ad-check.ts)의 AdCheck 모양으로 만든다.
import type { z } from "zod";
import type { AdAction, AdCheck, AdFinding, AdLineResult, AdUsage } from "@/lib/schemas/ad-check";
import type { Risk } from "@/lib/schemas/common";
import type { SampleCopy, SampleJudgment } from "./samples";

export const MAX_LINES = 20;
export const SAMPLE_MODEL = "샘플 (AI 미연결)";
export const SAMPLE_PROMPT_VERSION = "ad-check.v1 (초안)";

const SEVERITY: Record<AdAction, number> = { must_fix: 3, should_fix: 2, expert: 1, ok: 0 };
const RISK_BY_ACTION: Record<AdAction, Risk> = { must_fix: "high", should_fix: "medium", expert: "medium", ok: "low" };

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function detectLang(text: string): "ko" | "ja" {
  return /[぀-ヿ]/.test(text) ? "ja" : "ko";
}

export function splitInput(text: string): string[] {
  return text.split("\n").map(normalize).filter((line) => line.length > 0).slice(0, MAX_LINES);
}

export function countLines(text: string): number {
  return text.split("\n").filter((line) => line.trim().length > 0).length;
}

export function worstAction(actions: AdAction[]): AdAction {
  return actions.reduce<AdAction>((worst, a) => (SEVERITY[a] > SEVERITY[worst] ? a : worst), "ok");
}

export function countByAction(lines: AdLineResult[]): Record<AdAction, number> {
  const counts: Record<AdAction, number> = { must_fix: 0, should_fix: 0, expert: 0, ok: 0 };
  for (const line of lines) counts[line.action] += 1;
  return counts;
}

export type SampleBook = { copies: SampleCopy[]; judgments: SampleJudgment[] };

/** 한 줄을 판정한다. 샘플에 없으면 전문가 확인 */
export function judgeLine(original: string, lineIndex: number, book: SampleBook) {
  const target = normalize(original);
  const copy = book.copies.find((c) => normalize(c.ko) === target || normalize(c.ja_literal) === target);
  const judgment = copy && book.judgments.find((j) => j.sample_id === copy.id);

  if (!copy || !judgment) {
    const line: AdLineResult = {
      line_index: lineIndex,
      original,
      action: "expert",
      ingredient_check: "샘플에 없는 문구라 확인하지 않음",
      translated_text: null,
      back_translation_ko: null,
      localized_note: "샘플에 없는 문구입니다. 실제 AI 판정은 연결 후 제공됩니다.",
    };
    return { line, findings: [] as AdFinding[], sampleId: null, sampleProductId: null };
  }

  // 일본어 원문을 넣었으면 번역·역번역은 보여주지 않는다
  const isJa = normalize(copy.ja_literal) === target;
  const line: AdLineResult = {
    line_index: lineIndex,
    original,
    action: judgment.action,
    ingredient_check: judgment.ingredient_check,
    translated_text: isJa ? null : judgment.translated_text,
    back_translation_ko: isJa ? null : judgment.back_translation_ko,
    localized_note: judgment.localized_note,
  };
  const findings: AdFinding[] = judgment.findings.map((f) => ({ ...f, line_index: lineIndex }));
  return { line, findings, sampleId: copy.id, sampleProductId: copy.product_id };
}

type BuildInput = {
  id: string;
  workspaceId: string;
  createdAt: string;
  lines: string[];
  productId: string;
  usage: z.infer<typeof AdUsage>;
  book: SampleBook;
  review?: Partial<Pick<AdCheck, "review_status" | "reviewer_id" | "reviewer_note" | "final_text" | "reviewed_at" | "is_expert_review_requested">>;
};

/** 여러 줄 입력을 판정해 AdCheck 한 건을 만든다 */
export function buildAdCheck({ id, workspaceId, createdAt, lines, productId, usage, book, review }: BuildInput): AdCheck {
  const judged = lines.map((text, i) => judgeLine(text, i + 1, book));
  const lineResults = judged.map((j) => j.line);
  const overall = worstAction(lineResults.map((l) => l.action));
  const allJa = lineResults.every((l) => detectLang(l.original) === "ja");

  return {
    id,
    workspace_id: workspaceId,
    created_at: createdAt,
    model: SAMPLE_MODEL,
    prompt_version: SAMPLE_PROMPT_VERSION,
    input_text: lines.join("\n"),
    input_lang: allJa ? "ja" : "ko",
    findings: judged.flatMap((j) => j.findings),
    suggestions: [],
    reviewer_id: review?.reviewer_id ?? null,
    review_status: review?.review_status ?? "pending",
    reviewer_note: review?.reviewer_note ?? null,
    final_text: review?.final_text,
    reviewed_at: review?.reviewed_at,
    usage,
    product_id: productId,
    overall_risk: RISK_BY_ACTION[overall],
    overall_action: overall,
    line_results: lineResults,
    is_expert_review_requested: review?.is_expert_review_requested ?? false,
  };
}

/** 줄마다 샘플 기준 제품을 찾는다 (선택한 제품과 다르면 화면에 안내) */
export function sampleProductOf(original: string, book: SampleBook): string | null {
  const target = normalize(original);
  return book.copies.find((c) => normalize(c.ko) === target || normalize(c.ja_literal) === target)?.product_id ?? null;
}
