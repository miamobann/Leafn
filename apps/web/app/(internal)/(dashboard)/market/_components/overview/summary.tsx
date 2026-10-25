"use client";

import { EmptyState } from "@/components/common/states";
import type { Product } from "@/lib/schemas/product";
import type { SearchSnap } from "@/lib/schemas/search";
import type { TrendSnapshot } from "@/lib/schemas/trend";
import { keyPoints } from "@/app/(internal)/(dashboard)/market/_lib/summary";

/** 이번 주 핵심: 가격·할인 전략에 바로 쓰는 결론 4가지. 누르면 근거 섹션으로 이동한다 (AI 없이 계산 결과로 만든다) */
export function SummaryPart({ series, products, category, search }: { series: TrendSnapshot[]; products: Product[]; category: string; search: SearchSnap[] }) {
  const points = keyPoints({ series, products, category, search });
  if (points.length === 0) return <EmptyState message="이 플랫폼·카테고리의 랭킹 데이터가 없어요" />;

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {points.map((p) => (
        <a key={p.id} href={p.target} className="flex flex-col rounded-lg border bg-card p-3 hover:bg-muted">
          <span className="text-xs font-medium text-muted-foreground">{p.label}</span>
          <span className="mt-1 block text-sm font-semibold leading-snug">{p.headline}</span>
          <span className="mt-1 block text-xs text-muted-foreground">{p.detail}</span>
          <span className="mt-auto block pt-2 text-xs underline underline-offset-4">{p.go} →</span>
        </a>
      ))}
    </div>
  );
}
