"use client";

// 저장 직후 리포트 만들기: 리뷰를 저장하면 제품명 정리 → AI 분석 → 한국어 번역을 이어서 돌리고, 진행과 결과를 보여 준다.
// 저장은 이미 끝난 상태에서 시작하므로, AI가 실패해도 저장은 그대로다 (리뷰 화면의 [AI로 분석하기]로 이어서 할 수 있다).
import { useCallback, useRef, useState } from "react";
import { type PipelineProgress, runReviewPipeline, summarizeCounts } from "../_lib/review-pipeline";

export type ReportMaking =
  | { status: "idle" }
  | { status: "running"; progress: PipelineProgress | null }
  | { status: "done"; summary: string | null }
  | { status: "failed"; message: string; summary: string | null };

export function useReportMaking() {
  const [state, setState] = useState<ReportMaking>({ status: "idle" });
  const running = useRef(false);
  const lastProduct = useRef<string | undefined>(undefined);

  /** productId 가 없으면 모든 제품을 처리한다 (경쟁 제품 여러 개를 저장한 경우) */
  const start = useCallback(async (productId?: string) => {
    if (running.current) return;
    running.current = true;
    lastProduct.current = productId;
    setState({ status: "running", progress: null });
    try {
      const res = await runReviewPipeline(productId, (progress) => setState({ status: "running", progress }));
      const summary = summarizeCounts(res.counts);
      setState(res.ok ? { status: "done", summary } : { status: "failed", message: res.message, summary });
    } catch {
      setState({ status: "failed", message: "서버에 연결하지 못했어요.", summary: null });
    } finally {
      running.current = false;
    }
  }, []);

  const retry = useCallback(() => start(lastProduct.current), [start]);
  return { state, start, retry };
}
