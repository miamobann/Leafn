"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ResultPanel } from "./result-panel";
import { ReviewBar } from "./review-bar";
import { ReviewForm } from "./review-form";
import { EmptyView, ErrorView, LoadingView, type ViewState } from "./state-view";
import { judgeLine, splitInput } from "../_lib/judge";
import type { LineResult, Product, ReviewStatus, SampleCopy, SampleJudgment, Usage } from "../_lib/types";

// 실제 AI 호출이 없으므로 진행 상태를 보여주기 위한 짧은 대기
const FAKE_DELAY_MS = 600;

const COPY = {
  empty: "문구를 입력하고 「검토 요청」을 누르면 줄별 판정이 여기에 표시됩니다.",
  loading: "판단 단계 확인 중: 효능 범위 → 의약품적 표현 → 최상급·보증 표현 → 성분 일치 → 현지화",
  error: "검토 요청에 실패했습니다 (예시 화면). 잠시 후 다시 시도하세요.",
  stale: "입력이 바뀌었습니다. 다시 「검토 요청」을 누르면 새 입력으로 판정합니다.",
  retry: "다시 시도",
  loadSamples: "샘플 문구 불러오기",
};

type ReviewWorkspaceProps = {
  products: Product[];
  copies: SampleCopy[];
  judgments: SampleJudgment[];
  /** ?state= 로 강제한 화면 상태 (개발·테스트용) */
  forcedState: ViewState;
};

export function ReviewWorkspace({ products, copies, judgments, forcedState }: ReviewWorkspaceProps) {
  const [productId, setProductId] = useState(products[0].id);
  const [usage, setUsage] = useState<Usage>("상세페이지");
  const [text, setText] = useState("");
  const [submittedText, setSubmittedText] = useState<string | null>(null);
  const [lines, setLines] = useState<LineResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Record<number, string>>({});
  const [status, setStatus] = useState<ReviewStatus>("pending");
  const [note, setNote] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const productNames = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p.nameKo])), [products]);
  const lineCount = text.split("\n").filter((l) => l.trim().length > 0).length;

  const finalText = useMemo(
    () => (lines ?? []).map((line) => selected[line.lineIndex] ?? line.original).join("\n"),
    [lines, selected],
  );

  function loadSamples() {
    setText(
      copies
        .filter((c) => c.productId === productId)
        .map((c) => c.ko)
        .join("\n"),
    );
  }

  function submit() {
    const inputLines = splitInput(text);
    if (inputLines.length === 0) return;
    setBusy(true);
    setSubmittedText(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setLines(inputLines.map((line, i) => judgeLine(line, i + 1, copies, judgments)));
      setSelected({});
      setStatus("pending");
      setNote("");
      setBusy(false);
    }, FAKE_DELAY_MS);
  }

  function clear() {
    if (timer.current) clearTimeout(timer.current);
    setText("");
    setSubmittedText(null);
    setLines(null);
    setBusy(false);
    setSelected({});
    setStatus("pending");
    setNote("");
  }

  function selectSuggestion(lineIndex: number, suggestion: string | null) {
    setSelected((prev) => {
      const next = { ...prev };
      if (suggestion === null) delete next[lineIndex];
      else next[lineIndex] = suggestion;
      return next;
    });
  }

  function renderResult() {
    if (forcedState === "loading" || busy) return <LoadingView message={COPY.loading} />;
    if (forcedState === "error") {
      return (
        <ErrorView message={COPY.error}>
          <button type="button" onClick={clear} className="rounded-md border border-red-300 px-3 py-1.5">
            {COPY.retry}
          </button>
        </ErrorView>
      );
    }
    if (forcedState === "empty" || !lines) {
      return (
        <EmptyView message={COPY.empty}>
          <button type="button" onClick={loadSamples} className="rounded-md border border-border px-3 py-1.5 hover:bg-sidebar">
            {COPY.loadSamples}
          </button>
        </EmptyView>
      );
    }
    return (
      <div className="flex flex-col gap-4">
        {submittedText !== text && <p className="text-sm text-muted">{COPY.stale}</p>}
        <ResultPanel
          lines={lines}
          selectedProductId={productId}
          productNames={productNames}
          selected={selected}
          onSelect={selectSuggestion}
        />
        <ReviewBar finalText={finalText} note={note} onNoteChange={setNote} status={status} onStatusChange={setStatus} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(18rem,2fr)_3fr] items-start gap-6">
      <ReviewForm
        products={products}
        productId={productId}
        onProductChange={setProductId}
        usage={usage}
        onUsageChange={setUsage}
        text={text}
        onTextChange={setText}
        lineCount={lineCount}
        busy={busy}
        onLoadSamples={loadSamples}
        onSubmit={submit}
        onClear={clear}
      />
      <div>{renderResult()}</div>
    </div>
  );
}
