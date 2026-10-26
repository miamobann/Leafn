// 상세페이지용 리뷰처럼 여러 건을 한 번에 판정할 때: 응답 모양이 깨지면 한 건씩 다시 판정한다.
import { AdCheckParseError, type JudgeInput, judgeLines } from "./judge";
import type { JudgedLine } from "@/lib/schemas/ad-check-ai";

export type JudgedBatch = { lines: (JudgedLine | null)[]; model: string; promptVersion: string };

/** AI 응답 오류의 원인을 서버 로그에 남긴다 (화면 문구는 원인을 숨기므로, 팀원 PC에서 안 될 때 터미널에서 이 줄을 본다) */
export function logParseFailure(where: string, ids: string[], e: unknown) {
  const cause = e instanceof AdCheckParseError && e.cause instanceof Error ? e.cause.message : e instanceof Error ? e.message : String(e);
  console.error(`[${where}] AI 응답 형식 오류 · 리뷰 ${ids.length}건 (${ids.join(", ")}) · ${cause.slice(0, 800)}`);
}

/**
 * 리뷰 여러 건을 한 번에 판정하되, 응답 모양이 두 번 틀리면 한 건씩 다시 판정한다 (모양이 깨지는 리뷰 하나가 묶음 전체를 막지 않게).
 * 한 건씩도 틀리는 리뷰는 null로 두고 건너뛴다. 호출·설정 오류는 그대로 던진다.
 */
export async function judgeReviews(input: JudgeInput, ids: string[]): Promise<JudgedBatch> {
  try {
    const r = await judgeLines(input);
    return { lines: r.lines, model: r.model, promptVersion: r.promptVersion };
  } catch (e) {
    if (!(e instanceof AdCheckParseError) || input.lines.length === 1) {
      if (e instanceof AdCheckParseError) logParseFailure("translateReviews", ids, e);
      throw e;
    }
    logParseFailure("translateReviews", ids, e);
  }
  const lines: (JudgedLine | null)[] = [];
  let meta: { model: string; promptVersion: string } | null = null;
  let lastError: unknown;
  for (const [i, text] of input.lines.entries()) {
    try {
      const r = await judgeLines({ ...input, lines: [text] });
      lines.push(r.lines[0]);
      meta = { model: r.model, promptVersion: r.promptVersion };
    } catch (e) {
      if (!(e instanceof AdCheckParseError)) throw e;
      logParseFailure("translateReviews(한 건씩)", [ids[i]], e);
      lastError = e;
      lines.push(null);
    }
  }
  if (!meta) throw lastError;
  return { lines, ...meta };
}

