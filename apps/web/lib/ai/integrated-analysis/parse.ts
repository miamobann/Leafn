// 통합 AI 분석 응답을 검증하고 저장할 모양으로 다듬는다 (순수 함수 · 호출 없음, docs/team-approval-ai-analysis.md 10장).
// 응답의 ref(예: review@v2)는 입력 버전 ID로 바꾼다. 입력에 없는 ref를 인용한 문장은 버리지 않고 "근거 확인 필요"로 표시한다 (8장 보완 8).
// 모양이 틀리면 예외를 던지고, 호출하는 쪽(run.ts)이 1회 재시도한다 (CLAUDE.md 7장 1번).
// 종합 판단(verdict)이 프롬프트 규칙을 어기면 버리지 않고 코드가 fix_first로 낮춘 뒤 "근거 확인 필요"로 표시한다.
import { AiAnalysisOutput, type AiAnalysisPoint, AiAnalysisResult } from "@/lib/schemas/ai-analysis";
import type { IntegratedFacts, Perspective } from "./prompt";

/** AI 응답이 약속한 모양이 아닐 때. message 는 화면에 보여 줘도 안전하다 (모델 출력 원문은 cause 에만 있다) */
export class IntegratedAnalysisParseError extends Error {
  constructor(reason: string, cause?: unknown) {
    super(`AI 응답 형식이 맞지 않아 분석하지 못했습니다 (${reason})`, { cause });
  }
}

function stripFence(text: string) {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

/** 프롬프트 v2 #판단 단계 4단계: 미해결 광고 위험이 있거나 승인 탭이 2개 미만이면 go를 고르지 않는다 */
function goIsBlocked(facts: IntegratedFacts | undefined) {
  if (!facts) return false;
  return (facts.ad_unresolved_high ?? 0) > 0 || facts.approved_tabs.length < 2;
}

/** refs: ref → 버전 ID · facts: 입력에 같이 보낸 사실 (verdict 규칙 확인용) */
export function parseIntegratedAnalysis(
  text: string,
  perspectives: Perspective[],
  refs: Map<string, string>,
  facts?: IntegratedFacts,
): AiAnalysisResult {
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

  const verdictBasis = point({ text: output.verdict.reason || "-", basis: output.verdict.basis });
  const blocked = output.verdict.level === "go" && goIsBlocked(facts);
  const counterText = output.counterpoint.text.trim();
  const counterIds = output.counterpoint.basis.map((ref) => refs.get(ref.trim())).filter((id): id is string => Boolean(id));
  const headline = output.insight.headline.trim();
  if (!headline) throw new IntegratedAnalysisParseError("인사이트가 비어 있음");
  const insight = point({ text: headline, basis: output.insight.basis });

  return AiAnalysisResult.parse({
    summary: headline,
    insight: { ...insight, story: output.insight.story.trim() },
    // 카드 제목은 AI가 쓴 값 대신 프롬프트의 관점 이름을 쓴다 (화면 제목이 프롬프트 버전과 맞게)
    sections: output.sections.map((s, i) => ({
      key: s.key,
      title: perspectives[i].name,
      value: s.value.trim(),
      meaning: s.meaning.trim(),
      confidence: s.confidence,
      points: points(s.points),
    })),
    learnings: output.learnings.flatMap((l) => {
      const p = point({ text: l.headline, basis: l.basis });
      return p ? [{ ...p, kind: l.kind, label: l.label.trim(), action: l.action.trim() }] : [];
    }),
    // v2의 탭끼리 어긋나는 점은 v3에서 learnings(kind: conflict)로 들어간다
    conflicts: [],
    data_gaps: output.data_gaps.flatMap((g) => (g.text.trim() ? [{ text: g.text.trim(), tab: g.tab }] : [])),
    verdict: {
      level: blocked ? "fix_first" : output.verdict.level,
      reason: output.verdict.reason.trim(),
      basis: verdictBasis?.basis ?? [],
      ...((verdictBasis?.needs_check || blocked) && { needs_check: true }),
      ...(blocked && { adjusted_from: "go" as const }),
    },
    // 반대 근거가 없을 때는 basis가 비어도 된다. 인용한 ref가 입력에 없을 때만 "근거 확인 필요"
    ...(counterText && {
      counterpoint: {
        text: counterText,
        basis: [...new Set(counterIds)],
        ...(counterIds.length !== output.counterpoint.basis.length && { needs_check: true }),
      },
    }),
    actions: output.actions
      .flatMap((a) => {
        const p = point(a);
        const done = a.done_when.trim();
        return p ? [{ ...p, tab: a.tab, priority: Math.max(1, Math.round(a.priority)), ...(done && { done_when: done }) }] : [];
      })
      .toSorted((a, b) => a.priority - b.priority),
  });
}
