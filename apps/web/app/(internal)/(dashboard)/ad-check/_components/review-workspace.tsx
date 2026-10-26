"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { z } from "zod";
import { AiResultMeta } from "@/components/common/ai";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { ViewStateGate } from "@/components/common/view-state";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdCheck, AdLineResult, AdUsage } from "@/lib/schemas/ad-check";
import type { ReviewStatus } from "@/lib/schemas/common";
import { countLines } from "../_lib/lines";
import type { LabProduct } from "../_lib/products";
import { requestAdCheck, updateAdCheckReview, type AiMeta } from "../_lib/request";
import { CopyButton } from "./copy-button";
import { GuideRevisePanel, useGuideRevise } from "./guide-reflect";
import { ResultLines } from "./result-lines";
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
  canApprove?: boolean;
  /** 검토 내역의 「이 내용으로 새 검토」에서 넘어온 값. 자동으로 판정하지 않는다 (비용) */
  initial?: { productId?: string; usage?: z.infer<typeof AdUsage>; text?: string };
  /** 만든 가이드에서 넘어왔을 때 그 가이드 id → 판정 뒤 「가이드에 반영」으로 수정본을 만든다 */
  guideId?: string;
};

export function ReviewWorkspace({ products, workspaceId, canApprove = true, initial, guideId }: ReviewWorkspaceProps) {
  const { revise, revising, failure: reviseFailure, reset: resetRevise } = useGuideRevise(guideId);
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
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [persisted, setPersisted] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [aiMeta, setAiMeta] = useState<AiMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 나중에 끝난 이전 요청이 화면을 덮어쓰지 않게 요청 번호를 둔다
  const requestId = useRef(0);

  const lines = check?.line_results ?? [];
  const finalText = lines.map((l) => selected[l.line_index] ?? l.original).join("\n");

  function resetReview() {
    setSelected({});
    resetRevise();
    setStatus("pending");
    setExpertRequested(false);
    setNote("");
    setSaveState("idle");
    setSaveError(null);
  }

  async function persistReview(nextStatus: ReviewStatus, nextExpert: boolean, nextNote: string, nextFinal: string) {
    if (!check || !canApprove) return;
    setSaveState("saving");
    setSaveError(null);
    const res = await updateAdCheckReview(check.id, {
      review_status: nextStatus,
      is_expert_review_requested: nextExpert,
      reviewer_note: nextNote.trim() || null,
      final_text: nextFinal,
    });
    if (res.ok) {
      setSaveState("saved");
    } else {
      setSaveState("error");
      setSaveError(res.error);
    }
  }

  async function submit() {
    const product = products.find((p) => p.id === productId);
    if (!product || countLines(text) === 0) return;
    const id = (requestId.current += 1);
    setBusy(true);
    setError(null);
    setAiMeta(null);
    setSubmittedText(text);
    const result = await requestAdCheck({ workspaceId, product, usage, text, guideId });
    if (id !== requestId.current) return;
    if (result.ok) {
      // 화면에서 고른 제품을 결과에 남긴다
      setCheck({ ...result.check, product_id: productId });
      setAiMeta(result.meta);
      resetReview();
      setPersisted(result.saved);
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
        <ResultSummary check={check} next={<NextStep lines={lines} selected={selected} fromGuide={Boolean(guideId)} persisted={persisted} />} />
        <ResultLines lines={lines} findings={check.findings} selected={selected} onSelect={selectSuggestion} />
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
          persisted={persisted}
          canApprove={canApprove && persisted}
          saveState={saveState}
          saveError={saveError}
          onExpertToggle={() => {
            const nextExpert = !expertRequested;
            setExpertRequested(nextExpert);
            void persistReview(status, nextExpert, note, finalText);
          }}
          onSaveNote={() => void persistReview(status, expertRequested, note, finalText)}
        />
      )}
      {/* 만든 가이드에서 넘어왔으면: 고친 문구를 가이드 수정본으로 되돌린다 (약기법 우선: 「고쳐야 함」 줄은 대체 표현을 골라야 반영) */}
      {check && !busy && persisted && guideId && lines.some((l) => l.action !== "ok") && (
        <GuideRevisePanel
          stale={submittedText !== text}
          mustFixLeft={lines.filter((l) => l.action === "must_fix" && !selected[l.line_index]).length}
          checkLeft={lines.filter((l) => (l.action === "should_fix" || l.action === "expert") && !selected[l.line_index]).length}
          revising={revising}
          failure={reviseFailure}
          onRevise={() => check && void revise(check.id, selected)}
        />
      )}
      {/* 다음 단계: 결재는 콘텐츠 단위로 올린다 (2026-10-27). 콘텐츠에서 온 검토는 반영 뒤 콘텐츠로 돌아가고, 문구만 검토는 기록에 남는다 */}
      {check && !busy && persisted && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
          <span>{guideId ? "다음 단계 · 가이드에 반영한 뒤 콘텐츠에서 결재를 올려요." : "다음 단계 · 기록에 저장됐어요. 최종 문구를 복사해 쓰거나 기록에서 다시 볼 수 있어요."}</span>
          <span className="flex flex-wrap gap-2">
            <CopyButton text={finalText} label="최종 문구 복사" />
            <Link href={guideId ? `/ad-check/guide/history/${guideId}` : "/ad-check/history"} className={buttonVariants({ variant: "outline", size: "sm" })}>
              {guideId ? "콘텐츠로 돌아가기" : "기록에서 보기"}
            </Link>
          </span>
        </div>
      )}
    </ViewStateGate>
  );
}

/** 결론 칸의 「다음 할 일」: 대체 표현 고르기 → (가이드에서 왔으면) 가이드에 반영 · 결재 올리기 */
function NextStep({ lines, selected, fromGuide, persisted }: { lines: AdLineResult[]; selected: Record<number, string>; fromGuide: boolean; persisted: boolean }) {
  const toFix = lines.filter((l) => l.action !== "ok");
  const picked = toFix.filter((l) => selected[l.line_index]).length;
  const mustFixLeft = lines.filter((l) => l.action === "must_fix" && !selected[l.line_index]).length;
  // 다시 판정해 고칠 곳이 없으면 반영할 것도 없다 (가이드는 그대로 쓰면 된다)
  const steps =
    toFix.length === 0
      ? [fromGuide ? "고칠 곳 없음 · 가이드는 이대로 써도 돼요" : "고칠 곳 없음", fromGuide ? "콘텐츠에서 결재 올리기" : persisted ? "기록에 저장됨" : null].filter(Boolean)
      : [`① 대체 표현 고르기 (${picked}/${toFix.length})`, fromGuide ? "② 아래 「가이드에 반영」" : null, fromGuide ? "③ 콘텐츠에서 결재 올리기" : persisted ? "② 최종 문구 복사 · 기록에 저장됨" : null].filter(Boolean);
  return (
    <p className="text-sm">
      <span className="font-medium">다음 할 일 · </span>
      {steps.join(" → ")}
      {mustFixLeft > 0 && <span className="text-risk-high"> · 「고쳐야 함」 {mustFixLeft}줄이 남았어요</span>}
    </p>
  );
}
