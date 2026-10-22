"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { z } from "zod";
import { EmptyState, LoadingState } from "@/components/common/states";
import { ViewStateGate } from "@/components/common/view-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdCheck, AdUsage } from "@/lib/schemas/ad-check";
import type { ReviewStatus } from "@/lib/schemas/common";
import { buildAdCheck, countByAction, countLines, sampleProductOf, splitInput, type SampleBook } from "../_lib/judge";
import type { LabProduct } from "../_lib/products";
import { ACTION_TONE, ActionBadge } from "./ad-badges";
import { LineResultCard } from "./line-result-card";
import { ReviewBar } from "./review-bar";
import { ReviewForm } from "./review-form";

// 실제 AI 호출이 없으므로 진행 상태를 보여주기 위한 짧은 대기
const FAKE_DELAY_MS = 600;
// 렌더링 중 현재 시각을 읽지 않도록 고정 (lib/mock/helpers.ts의 PROTOTYPE_TODAY와 같은 날)
const DRAFT_CREATED_AT = "2026-10-21T10:00:00+09:00";

const COPY = {
  empty: "문구를 입력하고 「검토 요청」을 누르면 줄별 판정이 여기에 표시됩니다",
  emptyAction: "「이 제품의 샘플 문구 불러오기」로 시작해 보세요",
  loading: "판단 단계 확인 중: 효능 범위 → 의약품적 표현 → 최상급·보증 → 성분 → 제품 구분 → 현지화",
  stale: "입력이 바뀌었습니다. 다시 「검토 요청」을 누르면 새 입력으로 판정합니다.",
};

type ReviewWorkspaceProps = {
  products: LabProduct[];
  book: SampleBook;
  workspaceId: string;
};

export function ReviewWorkspace({ products, book, workspaceId }: ReviewWorkspaceProps) {
  const [productId, setProductId] = useState(products[0].id);
  const [usage, setUsage] = useState<z.infer<typeof AdUsage>>("detail_page");
  const [text, setText] = useState("");
  const [submittedText, setSubmittedText] = useState<string | null>(null);
  const [check, setCheck] = useState<AdCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Record<number, string>>({});
  const [status, setStatus] = useState<ReviewStatus>("pending");
  const [expertRequested, setExpertRequested] = useState(false);
  const [note, setNote] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const productNames = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p.name_ko])), [products]);
  const lines = check?.line_results ?? [];
  const counts = countByAction(lines);
  const finalText = lines.map((l) => selected[l.line_index] ?? l.original).join("\n");

  function resetReview() {
    setSelected({});
    setStatus("pending");
    setExpertRequested(false);
    setNote("");
  }

  function loadSamples() {
    setText(
      book.copies
        .filter((c) => c.product_id === productId)
        .map((c) => c.ko)
        .join("\n"),
    );
  }

  function submit() {
    const input = splitInput(text);
    if (input.length === 0) return;
    setBusy(true);
    setSubmittedText(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setCheck(buildAdCheck({ id: "draft", workspaceId, createdAt: DRAFT_CREATED_AT, lines: input, productId, usage, book }));
      resetReview();
      setBusy(false);
    }, FAKE_DELAY_MS);
  }

  function clear() {
    if (timer.current) clearTimeout(timer.current);
    setText("");
    setSubmittedText(null);
    setCheck(null);
    setBusy(false);
    resetReview();
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
    if (busy) return <LoadingState step={COPY.loading} />;
    if (!check) return <EmptyState message={COPY.empty} action={COPY.emptyAction} />;
    return (
      <div className="space-y-4">
        {submittedText !== text && <p className="text-sm text-muted-foreground">{COPY.stale}</p>}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
          <span className="font-semibold">전체 판정</span>
          {check.overall_action && <ActionBadge action={check.overall_action} />}
          <span className="text-muted-foreground">총 {lines.length}줄</span>
          {(Object.keys(counts) as (keyof typeof counts)[]).map((a) => (
            <span key={a}>
              {ACTION_TONE[a].label} {counts[a]}
            </span>
          ))}
        </div>
        {lines.map((line) => {
          const sampleProduct = sampleProductOf(line.original, book);
          return (
            <LineResultCard
              key={line.line_index}
              line={line}
              findings={check.findings.filter((f) => f.line_index === line.line_index)}
              mismatchProductName={sampleProduct && sampleProduct !== productId ? productNames[sampleProduct] : null}
              selectedSuggestion={selected[line.line_index] ?? null}
              onSelect={(s) => selectSuggestion(line.line_index, s)}
            />
          );
        })}
      </div>
    );
  }

  return (
    <ViewStateGate>
      <div className="grid grid-cols-[minmax(18rem,2fr)_3fr] items-start gap-4">
        {/* 결과가 길어도 입력 패널이 보이도록 고정한다 */}
        <Card className="sticky top-16">
          <CardHeader>
            <CardTitle>입력</CardTitle>
          </CardHeader>
          <CardContent>
            <ReviewForm
              products={products}
              productId={productId}
              onProductChange={setProductId}
              usage={usage}
              onUsageChange={setUsage}
              text={text}
              onTextChange={setText}
              lineCount={countLines(text)}
              busy={busy}
              onLoadSamples={loadSamples}
              onSubmit={submit}
              onClear={clear}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>결과</CardTitle>
          </CardHeader>
          <CardContent>{renderResult()}</CardContent>
        </Card>
      </div>
      {check && !busy && (
        <ReviewBar
          finalText={finalText}
          note={note}
          onNoteChange={setNote}
          status={status}
          expertRequested={expertRequested}
          onStatusChange={setStatus}
          onExpertToggle={() => setExpertRequested((v) => !v)}
        />
      )}
    </ViewStateGate>
  );
}
