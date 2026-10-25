// 리뷰 분석 AI 응답을 검증하고 저장할 모양으로 다듬는다 (순수 함수 · 호출 없음).
// 검증 실패는 예외로 던지고, 호출하는 쪽(analyze.ts)이 1회 재시도한다 (CLAUDE.md 7장 1번).
import type { ExcludedReason } from "@/lib/schemas/review";
import { AiReviewBatch, type AiReviewResult } from "@/lib/schemas/review-analysis-ai";

export const MAX_KEYWORDS = 5;
export const MAX_PHRASES = 3;
const MAX_KEYWORD_CHARS = 20;
const MAX_PHRASE_CHARS = 20;

/** 리뷰 한 건의 분석 결과. excluded 이면 분석 행은 만들지 않고 reviews.excluded_reason 만 채운다 */
export type ParsedReview = {
  index: number; // 입력한 순서 (0부터)
  excluded_reason: ExcludedReason | null;
  sentiment: AiReviewResult["sentiment"];
  topics: AiReviewResult["topics"];
  keywords: AiReviewResult["keywords"];
  pain_points: string[];
  repurchase_factors: string[];
};

/** AI 응답이 약속한 모양이 아닐 때. message 는 화면에 보여 줘도 안전하다 (모델 출력 원문은 cause 에만 있다) */
export class ReviewAnalysisParseError extends Error {
  constructor(reason: string, cause?: unknown) {
    super(`AI 응답 형식이 맞지 않아 분석하지 못했습니다 (${reason})`, { cause });
  }
}

function stripFence(text: string) {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

function uniqueTrimmed(values: string[], maxCount: number, maxChars: number) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = raw.trim().slice(0, maxChars);
    const key = v.toLowerCase();
    if (!v || seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= maxCount) break;
  }
  return out;
}

export function parseReviewAnalysis(text: string, expectedCount: number): ParsedReview[] {
  let json: unknown;
  try {
    json = JSON.parse(stripFence(text));
  } catch (e) {
    throw new ReviewAnalysisParseError("JSON 아님", e);
  }
  const parsed = AiReviewBatch.safeParse(json);
  if (!parsed.success) throw new ReviewAnalysisParseError("필드 오류", parsed.error);

  const byNumber = new Map<number, AiReviewResult>();
  for (const r of parsed.data.results) {
    if (r.n < 1 || r.n > expectedCount) throw new ReviewAnalysisParseError(`번호 범위 밖: ${r.n}`);
    if (byNumber.has(r.n)) throw new ReviewAnalysisParseError(`번호 중복: ${r.n}`);
    byNumber.set(r.n, r);
  }
  if (byNumber.size !== expectedCount) throw new ReviewAnalysisParseError(`건수 불일치: ${byNumber.size}/${expectedCount}`);

  return Array.from({ length: expectedCount }, (_, i) => {
    const r = byNumber.get(i + 1)!;
    if (r.excluded_reason) {
      // 제품 외 불만은 주제·키워드를 남기지 않는다 (프롬프트 #제약과 같은 규칙을 한 번 더 보장)
      return { index: i, excluded_reason: r.excluded_reason, sentiment: r.sentiment, topics: [], keywords: [], pain_points: [], repurchase_factors: [] };
    }
    const seenTopics = new Set<string>();
    const topics = r.topics.filter((t) => (seenTopics.has(t.topic) ? false : (seenTopics.add(t.topic), true)));
    const keywordTexts = uniqueTrimmed(r.keywords.map((k) => k.text), MAX_KEYWORDS, MAX_KEYWORD_CHARS);
    const keywords = keywordTexts.map((text) => ({
      text,
      category: r.keywords.find((k) => k.text.trim().slice(0, MAX_KEYWORD_CHARS).toLowerCase() === text.toLowerCase())!.category,
    }));
    return {
      index: i,
      excluded_reason: null,
      sentiment: r.sentiment,
      topics,
      keywords,
      pain_points: uniqueTrimmed(r.pain_points, MAX_PHRASES, MAX_PHRASE_CHARS),
      repurchase_factors: uniqueTrimmed(r.repurchase_factors, MAX_PHRASES, MAX_PHRASE_CHARS),
    };
  });
}
