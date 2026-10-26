// 통합 AI 분석 프롬프트 조립 (docs/team-approval-ai-analysis.md 10장). 원문은 prompts/integrated-analysis.v<N>.md 에만 있다 (CLAUDE.md 7장).
import { loadPrompt } from "@/lib/ai/prompts";
import type { SubmissionTab } from "@/lib/schemas/submission";
import { MIN_REVIEW_SAMPLE } from "./config";

/** #분석 관점의 한 줄 = 결과 섹션 하나. 관점을 더하거나 빼도 화면 코드는 그대로다 */
export type Perspective = { key: string; name: string };

const PERSPECTIVE_LINE = /^-\s*key:\s*([a-z0-9_]+)\s*·\s*이름:\s*(.+?)\s*·\s*설명:/;

/** 본문의 #분석 관점 절에서 관점 목록을 읽는다 */
export function parsePerspectives(body: string): Perspective[] {
  const section = body.split(/^#분석 관점\s*$/m)[1]?.split(/^#/m)[0] ?? "";
  return section.split("\n").flatMap((line) => {
    const m = PERSPECTIVE_LINE.exec(line.trim());
    return m ? [{ key: m[1], name: m[2] }] : [];
  });
}

/**
 * 머리말(--- 앞)은 사람이 읽는 설명이라 빼고 본문만 system 메시지로 쓴다.
 * #분석 관점 · #출력 형식 절이 없거나 관점을 하나도 못 읽으면 호출 전에 오류를 낸다 (리뷰 분석 buildSystemPrompt와 같은 방식)
 */
export async function buildSystemPrompt(version: number): Promise<{ text: string; version: string; perspectives: Perspective[] }> {
  const { text, version: id } = await loadPrompt("integrated-analysis", version);
  const body = text.split(/^---\s*$/m).slice(1).join("---").trim();
  if (!body.includes("#분석 관점") || !body.includes("#출력 형식")) throw new Error(`프롬프트 형식이 맞지 않습니다: ${id}`);
  const perspectives = parsePerspectives(body);
  if (perspectives.length === 0) throw new Error(`프롬프트에서 분석 관점을 읽지 못했습니다: ${id}`);
  return { text: body, version: id, perspectives };
}

export type IntegratedInputVersion = {
  /** 저장할 때 basis를 바꿀 실제 버전 ID */
  id: string;
  /** AI가 근거로 쓰는 이름. 예: review@v2 */
  ref: string;
  tab: SubmissionTab;
  summary: string;
  body: Record<string, unknown>;
  data_as_of: string | null;
};

export type IntegratedInput = {
  product: { name: string; skin_line: string | null; sale_status: string | null };
  versions: IntegratedInputVersion[];
};

/** 근거 리뷰 ID 목록은 AI가 쓸 일이 없고 길기만 해서 뺀다 */
function compact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(compact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "evidence_review_ids")
        .map(([key, v]) => [key, compact(v)]),
    );
  }
  return value;
}

/** 프롬프트 #입력 형식의 facts. 날짜 차이 · 표본 수 · 미해결 광고 위험은 AI에게 맡기지 않고 코드가 센다 */
export type IntegratedFacts = {
  approved_tabs: SubmissionTab[];
  data_gap_days: number | null;
  review_sample_small: boolean | null;
  ad_unresolved_high: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function computeFacts(versions: IntegratedInputVersion[]): IntegratedFacts {
  const times = versions.flatMap((v) => (v.data_as_of ? [Date.parse(v.data_as_of)] : [])).filter((t) => !Number.isNaN(t));
  const review = versions.find((v) => v.tab === "review");
  const ad = versions.find((v) => v.tab === "ad");
  const analyzed = review?.body.analyzed_count;
  const items = Array.isArray(ad?.body.items) ? (ad.body.items as { overall_risk?: unknown; final_text?: unknown }[]) : [];
  return {
    approved_tabs: [...new Set(versions.map((v) => v.tab))],
    data_gap_days: times.length > 1 ? Math.round((Math.max(...times) - Math.min(...times)) / DAY_MS) : null,
    review_sample_small: review ? typeof analyzed !== "number" || analyzed < MIN_REVIEW_SAMPLE : null,
    ad_unresolved_high: ad ? items.filter((i) => i.overall_risk === "high" && !(typeof i.final_text === "string" && i.final_text.trim())).length : null,
  };
}

/** 프롬프트 #입력 형식대로: 제품 한 줄 + facts 한 줄 + 승인본 한 줄씩 (JSON) */
export function buildUserMessage(input: IntegratedInput, facts: IntegratedFacts = computeFacts(input.versions)): string {
  return [
    "#입력",
    `product: ${JSON.stringify(input.product)}`,
    `facts: ${JSON.stringify(facts)}`,
    "versions:",
    ...input.versions.map(
      (v) =>
        `- ${JSON.stringify({ ref: v.ref, tab: v.tab, summary: v.summary, data_as_of: v.data_as_of?.slice(0, 10) ?? null, body: compact(v.body) })}`,
    ),
    `위 승인본 ${input.versions.length}개만 근거로, basis에는 위 ref만 쓰세요.`,
  ].join("\n");
}
