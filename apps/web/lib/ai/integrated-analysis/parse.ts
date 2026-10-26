// 통합 AI 분석 응답을 검증하고 저장할 모양으로 다듬는다 (순수 함수 · 호출 없음, docs/team-approval-ai-analysis.md 10장).
// 응답의 ref(예: review@v2)는 입력 버전 ID로 바꾼다. 입력에 없는 ref를 인용한 문장은 버리지 않고 "근거 확인 필요"로 표시한다 (8장 보완 8).
// 모양이 틀리면 예외를 던지고, 호출하는 쪽(run.ts)이 1회 재시도한다 (CLAUDE.md 7장 1번).
import { AiAnalysisOutput, type AiAnalysisPoint, AiAnalysisResult } from "@/lib/schemas/ai-analysis";
import type { Perspective } from "./prompt";

/** AI 응답이 약속한 모양이 아닐 때. message 는 화면에 보여 줘도 안전하다 (모델 출력 원문은 cause 에만 있다) */
export class IntegratedAnalysisParseError extends Error {
  constructor(reason: string, cause?: unknown) {
    super(`AI 응답 형식이 맞지 않아 분석하지 못했습니다 (${reason})`, { cause });
  }
}

function stripFence(text: string) {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

/** refs: ref → 버전 ID */
export function parseIntegratedAnalysis(text: string, perspectives: Perspective[], refs: Map<string, string>): AiAnalysisResult {
  let json: unknown;
  try {
    json = JSON.parse(stripFence(text));
  } catch (e) {
    throw new IntegratedAnalysisParseError("JSON이 아님", e);
  }
  const parsed = AiAnalysisOutput.safeParse(json);
  if (!parsed.success) throw new IntegratedAnalysisParseError("칸이 맞지 않음", parsed.error);
  const output = parsed.data;

  // 섹션은 프롬프트 #분석 관점의 순서와 key를 그대로 따라야 한다
  const keys = output.sections.map((s) => s.key);
  if (keys.join(",") !== perspectives.map((p) => p.key).join(",")) {
    throw new IntegratedAnalysisParseError(`관점이 프롬프트와 다름: ${keys.join(", ")}`);
  }

  const point = (p: { text: string; basis: string[] }): AiAnalysisPoint | null => {
    const text = p.text.trim();
    if (!text) return null;
    const ids = p.basis.map((ref) => refs.get(ref.trim()));
    const known = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    const needsCheck = known.length === 0 || known.length !== p.basis.length;
    return needsCheck ? { text, basis: known, needs_check: true } : { text, basis: known };
  };
  const points = (list: { text: string; basis: string[] }[]) => list.flatMap((p) => point(p) ?? []);

  return AiAnalysisResult.parse({
    summary: output.summary.trim(),
    // 섹션 제목은 AI가 쓴 값 대신 프롬프트의 관점 이름을 쓴다 (화면 제목이 프롬프트 버전과 맞게)
    sections: output.sections.map((s, i) => ({ key: s.key, title: perspectives[i].name, points: points(s.points) })),
    conflicts: points(output.conflicts),
    data_gaps: output.data_gaps.map((g) => g.trim()).filter(Boolean),
    actions: output.actions
      .flatMap((a) => {
        const p = point(a);
        return p ? [{ ...p, tab: a.tab, priority: Math.max(1, Math.round(a.priority)) }] : [];
      })
      .toSorted((a, b) => a.priority - b.priority),
  });
}
