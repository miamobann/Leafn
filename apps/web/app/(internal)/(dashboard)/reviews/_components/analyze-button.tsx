"use client";

// 리뷰 AI 처리 시작 줄: 제품명 정리 전인 경쟁 제품, 분석 전인 리뷰, 번역이 없는 일본어 리뷰가 있을 때만 나온다.
// 1) 제품명 정리(긴 일본어 제목 → 브랜드 · 제품명 · 용량 · 대표 성분 + 한국어) → 2) 분석(감성 · 주제 · 키워드, 제품 외 불만 걸러내기)
// → 3) 일본어 리뷰 한국어 번역 순서로 끝날 때까지 반복해서 부르고, 끝나면 화면을 새로 읽는다.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { summarizeNextBatch } from "@/lib/data/product-title-actions";
import { analyzeNextBatch, translateNextBatch } from "@/lib/data/review-analysis-actions";

type Phase = "name" | "analyze" | "translate";
type Progress = { running: Phase | null; done: number; total: number; message: string | null; failed: boolean };

const IDLE: Progress = { running: null, done: 0, total: 0, message: null, failed: false };

/** productId 가 없으면 모든 제품을 차례로 처리한다 */
export function AnalyzeButton({ productId, pending, untranslated, untitled }: { productId?: string; pending: number; untranslated: number; untitled: number }) {
  const router = useRouter();
  const [progress, setProgress] = useState<Progress>(IDLE);

  async function run() {
    let named = 0;
    let analyzed = 0;
    let excluded = 0;
    let translated = 0;
    const stop = (message: string) => {
      setProgress({ ...IDLE, message, failed: true });
      router.refresh(); // 여기까지 저장된 결과는 보여 준다
    };

    if (untitled > 0) {
      setProgress({ running: "name", done: 0, total: untitled, message: null, failed: false });
      for (;;) {
        const res = await summarizeNextBatch(productId);
        if (!res.ok) return stop(res.message);
        named += res.data.processed;
        setProgress((p) => ({ ...p, done: named }));
        if (res.data.remaining === 0 || res.data.processed === 0) break;
      }
    }

    if (pending > 0) {
      setProgress({ running: "analyze", done: 0, total: pending, message: null, failed: false });
      for (;;) {
        const res = await analyzeNextBatch(productId);
        if (!res.ok) return stop(res.message);
        analyzed += res.data.processed;
        excluded += res.data.excluded;
        setProgress((p) => ({ ...p, done: analyzed }));
        if (res.data.remaining === 0 || res.data.processed === 0) break;
      }
    }

    // 제외된 리뷰는 번역하지 않으므로, 분석 뒤에 남은 건수를 번역 단계에서 다시 센다
    let translateTotal = 0;
    for (;;) {
      const res = await translateNextBatch(productId);
      if (!res.ok) return stop(res.message);
      if (res.data.processed === 0) break;
      translated += res.data.processed;
      translateTotal = Math.max(translateTotal, translated + res.data.remaining);
      setProgress({ running: "translate", done: translated, total: translateTotal, message: null, failed: false });
      if (res.data.remaining === 0) break;
    }

    const parts = [named > 0 && `${named}개 제품명 정리`, analyzed > 0 && `${analyzed}건 분석`, translated > 0 && `${translated}건 한국어 번역`].filter(Boolean).join(" · ");
    const note = excluded > 0 ? ` (배송 · 파손 등 제품 외 불만 ${excluded}건은 분석에서 뺐어요)` : "";
    setProgress({ ...IDLE, message: `${parts || "처리할 것이 없었어요"}${parts ? "을 마쳤어요" : ""}${note}` });
    router.refresh();
  }

  const running = progress.running !== null;
  const needed = pending > 0 || untranslated > 0 || untitled > 0;
  if (!needed && !running && !progress.message) return null;

  const RUNNING_TEXT: Record<Phase, string> = {
    name: "긴 제품명을 정리하고 있어요…",
    analyze: "AI가 리뷰를 읽고 있어요…",
    translate: "일본어 리뷰를 한국어로 옮기고 있어요…",
  };
  const todo = [
    untitled > 0 && `제품명 정리 전인 경쟁 제품 ${untitled}개`,
    pending > 0 && `AI 분석 전인 리뷰 ${pending}건`,
    untranslated > 0 && `한국어 번역이 없는 일본어 리뷰 ${untranslated}건`,
  ].filter(Boolean);
  const text = running ? `${RUNNING_TEXT[progress.running!]} ${progress.done} / ${progress.total}${progress.running === "name" ? "개" : "건"}` : (progress.message ?? `${todo.join(", ")}이 있어요.`);
  const label = progress.failed ? "이어서 하기" : pending > 0 ? "AI로 분석하기" : untranslated > 0 ? "한국어로 번역하기" : "제품명 정리하기";

  return (
    <div className="mb-4 space-y-1.5 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span role={progress.failed ? "alert" : "status"} className={progress.failed ? "text-destructive" : undefined}>
          {text}
        </span>
        {(needed || progress.failed) && (
          <Button size="sm" onClick={run} disabled={running}>
            {label}
          </Button>
        )}
      </div>
      {running ? (
        <p className="text-xs text-muted-foreground">
          리뷰 50건(제품 30개)마다 10~20초쯤 걸려요. 끝날 때까지 이 화면을 닫거나 다른 화면으로 이동하지 마세요. 끝나면 결과가 자동으로 나타나요.
        </p>
      ) : (
        needed &&
        !progress.failed && (
          <p className="text-xs text-muted-foreground">
            긴 일본어 제품명을 「브랜드 · 제품명 · 용량 · 대표 성분」으로 줄이고 한국어 캡션을 붙여요. 리뷰는 감성 · 6개 주제 · 키워드로 나누고, 배송 · 파손처럼 제품과 상관없는 불만은 분석에서 빼요. 일본어 리뷰는 한국어 번역을 만들고, 원문은 누르면 볼 수 있어요. 처리한 것은 다시 처리하지 않아요.
          </p>
        )
      )}
    </div>
  );
}
