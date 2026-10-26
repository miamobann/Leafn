"use client";

// AI 분석 실행 폼 (docs/team-approval-ai-analysis.md 3장 5, 8장 보완 2).
// 제품을 고르고 탭마다 승인본을 하나씩 고른다 (기본값은 지금 기준 승인본). 데이터 기준 날짜가 30일 넘게 벌어지면 경고한다
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { runAiAnalysis } from "@/lib/data/ai-analysis-actions";
import { formatDate } from "@/lib/format";
import { SUBMISSION_TAB_LABELS, SubmissionTab } from "@/lib/schemas/submission";

const TEXT = {
  product: "제품",
  none: "넣지 않음",
  noApproved: "승인본 없음",
  run: "AI 분석 실행",
  running: "분석 중… (최대 1분)",
  sample: "샘플 데이터예요. 로그인한 워크스페이스에서만 실행할 수 있어요.",
  noProducts: "판매 중인 제품이 없어요.",
  needOne: "승인본을 하나 이상 골라 주세요",
  gap: (days: number, max: number) =>
    `고른 승인본의 데이터 기준 날짜가 ${days}일 벌어져 있어요 (${max}일 초과). 시점이 다른 결론이 섞일 수 있어요.`,
  dataAsOf: "기준",
};

export type VersionOption = { id: string; label: string; dataAsOf: string | null };
export type ProductOption = {
  id: string;
  name: string;
  byTab: Record<SubmissionTab, VersionOption[]>;
  defaults: Record<SubmissionTab, string>;
};

const dayOf = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000;

export function RunForm({
  products,
  initialProductId,
  sampleMode,
  maxGapDays,
}: {
  products: ProductOption[];
  initialProductId: string | null;
  sampleMode: boolean;
  maxGapDays: number;
}) {
  const router = useRouter();
  const first = products.find((p) => p.id === initialProductId) ?? products[0];
  const [productId, setProductId] = useState(first?.id ?? "");
  const [picks, setPicks] = useState<Record<SubmissionTab, string>>(first?.defaults ?? { market: "", review: "", ad: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!first) return <p className="text-sm text-muted-foreground">{TEXT.noProducts}</p>;
  const product = products.find((p) => p.id === productId) ?? first;

  const picked = SubmissionTab.options.flatMap((tab) => {
    const v = product.byTab[tab].find((o) => o.id === picks[tab]);
    return v ? [v] : [];
  });
  const dates = picked.flatMap((v) => (v.dataAsOf ? [dayOf(v.dataAsOf)] : []));
  const gap = dates.length > 1 ? Math.max(...dates) - Math.min(...dates) : 0;

  function run() {
    if (picked.length === 0) {
      setError(TEXT.needOne);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await runAiAnalysis(product.id, picked.map((v) => v.id));
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(`/ai-analysis/${result.data.analysisId}`);
    });
  }

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      {sampleMode && <p className="text-sm text-muted-foreground">{TEXT.sample}</p>}
      <label className="block space-y-1 text-sm">
        <span className="font-medium">{TEXT.product}</span>
        <select
          className="h-9 w-full max-w-sm rounded-md border bg-background px-2"
          value={product.id}
          onChange={(e) => {
            const next = products.find((p) => p.id === e.target.value);
            if (!next) return;
            setProductId(next.id);
            setPicks(next.defaults);
          }}
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        {SubmissionTab.options.map((tab) => (
          <label key={tab} className="block space-y-1 text-sm">
            <span className="font-medium">{SUBMISSION_TAB_LABELS[tab]}</span>
            <select
              className="h-9 w-full rounded-md border bg-background px-2"
              value={picks[tab]}
              disabled={product.byTab[tab].length === 0}
              onChange={(e) => setPicks({ ...picks, [tab]: e.target.value })}
            >
              <option value="">{product.byTab[tab].length === 0 ? TEXT.noApproved : TEXT.none}</option>
              {product.byTab[tab].map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                  {o.dataAsOf ? ` (${TEXT.dataAsOf} ${formatDate(o.dataAsOf)})` : ""}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {gap > maxGapDays && (
        <p role="note" className="rounded-md border border-status-pending/40 bg-status-pending/5 p-3 text-sm">
          {TEXT.gap(gap, maxGapDays)}
        </p>
      )}
      <Button disabled={sampleMode || pending || picked.length === 0} onClick={run}>
        {pending ? TEXT.running : TEXT.run}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
