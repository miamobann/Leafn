// 리뷰 AI 처리 한 번에 끝내기: 1) 제품명 정리 → 2) 분석(감성 · 주제 · 키워드, 제품 외 불만 걸러내기) → 3) 일본어 리뷰 한국어 번역.
// 서버 액션을 10~20초짜리 묶음(리뷰 50건 · 제품 30개)씩 끝날 때까지 부른다. 처리할 것이 없는 단계는 AI를 부르지 않고 바로 지나간다.
// 리뷰 화면의 [AI로 분석하기]와 리뷰 가져오기의 저장 직후 자동 처리가 같이 쓴다. productId 가 없으면 모든 제품을 처리한다.
import { summarizeNextBatch } from "@/lib/data/product-title-actions";
import { analyzeNextBatch, translateNextBatch } from "@/lib/data/review-analysis-actions";

export type PipelinePhase = "name" | "analyze" | "translate";
export type PipelineProgress = { phase: PipelinePhase; done: number; total: number };
export type PipelineCounts = { named: number; analyzed: number; excluded: number; translated: number };
/** ok: false 여도 counts 는 거기까지 저장된 양이다 (이미 저장된 결과는 남는다) */
export type PipelineResult = ({ ok: true } | { ok: false; message: string }) & { counts: PipelineCounts };

export async function runReviewPipeline(productId: string | undefined, onProgress: (p: PipelineProgress) => void): Promise<PipelineResult> {
  const counts: PipelineCounts = { named: 0, analyzed: 0, excluded: 0, translated: 0 };
  const stop = (message: string): PipelineResult => ({ ok: false, message, counts });

  // 제품명 정리
  for (let total = 0; ; ) {
    const res = await summarizeNextBatch(productId);
    if (!res.ok) return stop(res.message);
    if (res.data.processed === 0) break;
    counts.named += res.data.processed;
    total = Math.max(total, counts.named + res.data.remaining);
    onProgress({ phase: "name", done: counts.named, total });
    if (res.data.remaining === 0) break;
  }

  // 분석
  for (let total = 0; ; ) {
    const res = await analyzeNextBatch(productId);
    if (!res.ok) return stop(res.message);
    if (res.data.processed === 0) break;
    counts.analyzed += res.data.processed;
    counts.excluded += res.data.excluded;
    total = Math.max(total, counts.analyzed + res.data.remaining);
    onProgress({ phase: "analyze", done: counts.analyzed, total });
    if (res.data.remaining === 0) break;
  }

  // 번역 (제외된 리뷰는 번역하지 않으므로 분석 뒤에 센다)
  for (let total = 0; ; ) {
    const res = await translateNextBatch(productId);
    if (!res.ok) return stop(res.message);
    if (res.data.processed === 0) break;
    counts.translated += res.data.processed;
    total = Math.max(total, counts.translated + res.data.remaining);
    onProgress({ phase: "translate", done: counts.translated, total });
    if (res.data.remaining === 0) break;
  }

  return { ok: true, counts };
}

/** "3개 제품명 정리 · 120건 분석 …을 마쳤어요" 같은 결과 한 줄. 한 일이 없으면 null */
export function summarizeCounts(c: PipelineCounts): string | null {
  const parts = [c.named > 0 && `${c.named}개 제품명 정리`, c.analyzed > 0 && `${c.analyzed}건 분석`, c.translated > 0 && `${c.translated}건 한국어 번역`].filter(Boolean).join(" · ");
  if (!parts) return null;
  return `${parts}을 마쳤어요${c.excluded > 0 ? ` (배송 · 파손 등 제품 외 불만 ${c.excluded}건은 분석에서 뺐어요)` : ""}`;
}

export const PIPELINE_PHASE_TEXT: Record<PipelinePhase, string> = {
  name: "긴 제품명을 정리하고 있어요…",
  analyze: "AI가 리뷰를 읽고 있어요…",
  translate: "일본어 리뷰를 한국어로 옮기고 있어요…",
};
