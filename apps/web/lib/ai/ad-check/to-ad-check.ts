import type { z } from "zod";
import { AdCheck, type AdFinding, type AdLineResult, type AdUsage } from "@/lib/schemas/ad-check";
import type { JudgedLine } from "@/lib/schemas/ad-check-ai";
import { RISK_BY_ACTION, worstAction } from "./action";

export type ToAdCheckInput = {
  id: string;
  workspaceId: string;
  createdAt: string; // ISO 시각 (시간대 포함)
  /** 검토한 입력 줄. judged 와 같은 순서·같은 개수 */
  lines: string[];
  judged: JudgedLine[];
  productId?: string;
  usage: z.infer<typeof AdUsage>;
  model: string;
  promptVersion: string;
};

// 일본어 가나가 한 글자라도 있으면 일본어 줄로 본다 (프롬프트의 한국어/일본어 자동 감지와 같은 기준)
const hasKana = (text: string) => /[぀-ヿ]/.test(text);

/** 줄별 판정을 저장·화면에 쓰는 AdCheck 한 건으로 합친다. 모양이 틀리면 여기서 Error 를 던진다 */
export function toAdCheck({ id, workspaceId, createdAt, lines, judged, productId, usage, model, promptVersion }: ToAdCheckInput): AdCheck {
  if (lines.length !== judged.length) throw new Error(`입력 ${lines.length}줄과 판정 ${judged.length}줄이 맞지 않음`);

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

  return AdCheck.parse({
    id,
    workspace_id: workspaceId,
    created_at: createdAt,
    model,
    prompt_version: promptVersion,
    input_text: lines.join("\n"),
    input_lang: lines.every(hasKana) ? "ja" : "ko",
    findings,
    suggestions: [], // 대체 표현은 각 finding 안에 있다
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
