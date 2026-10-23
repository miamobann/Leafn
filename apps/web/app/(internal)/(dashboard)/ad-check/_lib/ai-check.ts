// AI 판정 결과(JudgedLine) → 화면이 쓰는 AdCheck 모양 (연습장 전용). 서버·화면 어디서든 쓸 수 있는 순수 함수만 둔다.
// 샘플 판정용 buildAdCheck(judge.ts)는 그대로 두고, AI 판정은 이쪽으로 만든다.
import { AdCheck, type AdAction, type AdFinding, type AdLineResult, type AdUsage } from "@/lib/schemas/ad-check";
import type { Risk } from "@/lib/schemas/common";
import type { z } from "zod";
import { worstAction } from "./judge";
import type { JudgedLine, Usage } from "./prompt-lab";

const RISK_BY_ACTION: Record<AdAction, Risk> = { must_fix: "high", should_fix: "medium", expert: "medium", ok: "low" };

/** 화면에 보여 줄 호출 정보. 키·요청 내용은 넣지 않는다 */
export type AiMeta = {
  model: string;
  promptVersion: string;
  usage: Usage;
  sentLines: number;
  cachedLines: number;
};

export type AiJudgeResult = { ok: true; check: AdCheck; meta: AiMeta } | { ok: false; error: string };

type BuildInput = {
  id: string;
  workspaceId: string;
  createdAt: string;
  lines: string[];
  judged: JudgedLine[]; // lines 와 같은 순서
  productId: string;
  usage: z.infer<typeof AdUsage>;
  model: string;
  promptVersion: string;
};

export function buildAiAdCheck({ id, workspaceId, createdAt, lines, judged, productId, usage, model, promptVersion }: BuildInput): AdCheck {
  const lineResults: AdLineResult[] = lines.map((original, i) => ({
    line_index: i + 1,
    original,
    action: judged[i].action,
    ingredient_check: judged[i].ingredient_check,
    translated_text: judged[i].translated_text,
    back_translation_ko: judged[i].back_translation_ko,
    localized_note: judged[i].localized_note,
  }));
  const findings: AdFinding[] = judged.flatMap((j, i) => j.findings.map((f) => ({ ...f, line_index: i + 1 })));
  const overall = worstAction(lineResults.map((l) => l.action));
  const allJa = lines.every((l) => /[぀-ヿ]/.test(l));

  // 모양이 틀리면 여기서 걸려 화면까지 가지 않는다
  return AdCheck.parse({
    id,
    workspace_id: workspaceId,
    created_at: createdAt,
    model,
    prompt_version: promptVersion,
    input_text: lines.join("\n"),
    input_lang: allJa ? "ja" : "ko",
    findings,
    suggestions: [],
    reviewer_id: null,
    review_status: "pending",
    reviewer_note: null,
    usage,
    product_id: productId,
    overall_risk: RISK_BY_ACTION[overall],
    overall_action: overall,
    line_results: lineResults,
    is_expert_review_requested: false,
  });
}
