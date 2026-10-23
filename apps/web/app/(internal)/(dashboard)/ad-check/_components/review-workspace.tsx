"use client";

import { useRef, useState } from "react";
import type { z } from "zod";
import { AiResultMeta } from "@/components/common/ai";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { ViewStateGate } from "@/components/common/view-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdCheck, AdUsage } from "@/lib/schemas/ad-check";
import type { ReviewStatus } from "@/lib/schemas/common";
import { countLines } from "../_lib/lines";
import type { LabProduct } from "../_lib/products";
import { requestAdCheck, type AiMeta } from "../_lib/request";
import { LineResultCard } from "./line-result-card";
import { ResultSummary } from "./result-summary";
import { ReviewBar } from "./review-bar";
import { ReviewForm } from "./review-form";

const COPY = {
  empty: "문구를 입력하고 「검토 요청」을 누르면 AI가 줄별로 판정합니다 (10초 안팎)",
  loading: "판단 단계 확인 중: 효능 범위 → 의약품적 표현 → 최상급·보증 → 성분 → 제품 구분 → 현지화",
  stale: "입력이 바뀌었습니다. 다시 「검토 요청」을 누르면 새 입력으로 판정합니다.",
};

type ReviewWorkspaceProps = {
  products: LabProduct[];
  workspaceId: string;
  /** 검토 내역의 「이 내용으로 새 검토」에서 넘어온 값. 자동으로 판정하지 않는다 (비용) */
  initial?: { productId?: string; usage?: z.infer<typeof AdUsage>; text?: string };
};

export function ReviewWorkspace({ products, workspaceId, initial }: ReviewWorkspaceProps) {
  const [productId, setProductId] = useState(
    initial?.productId && products.some((p) => p.id === initial.productId) ? initial.productId : products[0].id,
  );
  const [usage, setUsage] = useState<z.infer<typeof AdUsage>>(initial?.usage ?? "detail_page");
  const [text, setText] = useState(initial?.text ?? "");
  const [submittedText, setSubmittedText] = useState<string | null>(null);
  const [check, setCheck] = useState<AdCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Record<number, string>>({});
  const [status, setStatus] = useState<ReviewStatus>("pending");
  const [expertRequested, setExpertRequested] = useState(false);
  const [note, setNote] = useState("");
  const [aiMeta, setAiMeta] = useState<AiMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 나중에 끝난 이전 요청이 화면을 덮어쓰지 않게 요청 번호를 둔다
  const requestId = useRef(0);

  const lines = check?.line_results ?? [];
  const finalText = lines.map((l) => selected[l.line_index] ?? l.original).join("\n");

  function resetReview() {
    setSelected({});
    setStatus("pending");
    setExpertRequested(false);
    setNote("");
  }

  async function submit() {
    const product = products.find((p) => p.id === productId);
    if (!product || countLines(text) === 0) return;
    const id = (requestId.current += 1);
    setBusy(true);
    setError(null);
    setAiMeta(null);
    setSubmittedText(text);
    const result = await requestAdCheck({ workspaceId, product, usage, text });
    if (id !== requestId.current) return;
    if (result.ok) {
      // 화면에서 고른 제품을 결과에 남긴다 (API는 제품 이름만 받는다)
      setCheck({ ...result.check, product_id: productId });
      setAiMeta(result.meta);
      resetReview();
    } else {
      setCheck(null);
      setError(result.error);
    }
    setBusy(false);
  }

  function clear() {
    requestId.current += 1;
    setError(null);
    setAiMeta(null);
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
    if (error) return <ErrorState message={error} />;
    if (!check) return <EmptyState message={COPY.empty} />;
    return (
      <div className="space-y-4">
        {submittedText !== text && <p className="text-sm text-muted-foreground">{COPY.stale}</p>}
        <ResultSummary check={check} />
        {lines.map((line) => (
          <LineResultCard
            key={line.line_index}
            line={line}
            findings={check.findings.filter((f) => f.line_index === line.line_index)}
            selectedSuggestion={selected[line.line_index] ?? null}
            onSelect={(s) => selectSuggestion(line.line_index, s)}
          />
        ))}
        {aiMeta && (
          <div className="space-y-0.5">
            <AiResultMeta model={check.model} promptVersion={check.prompt_version} createdAt={check.created_at} />
            <p className="text-xs text-muted-foreground">
              입력 {aiMeta.usage.input.toLocaleString("en-US")}(캐시 {aiMeta.usage.cached.toLocaleString("en-US")}) · 출력{" "}
              {aiMeta.usage.output.toLocaleString("en-US")} 토큰{aiMeta.attempts > 1 ? ` · 재시도 ${aiMeta.attempts - 1}회` : ""}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <ViewStateGate>
      <div className="grid grid-cols-[minmax(18rem,2fr)_3fr] items-start gap-4">
        <Card>
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
              onSubmit={() => void submit()}
              onClear={clear}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>결과</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[75vh] overflow-y-auto" role="region" aria-label="판정 결과" tabIndex={0}>
            {renderResult()}
          </CardContent>
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
