"use client";

import { EmptyState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import type { GeoSnap } from "@/lib/schemas/geo";
import type { Product } from "@/lib/schemas/product";
import type { SearchSnap } from "@/lib/schemas/search";
import type { TrendSnapshot } from "@/lib/schemas/trend";
import { keyPoints, type MarketTab } from "@/app/(internal)/(dashboard)/market/_lib/summary";

/** 요약 탭: 결론 → 바로 할 일 → 근거 → [탭 열기]. AI 없이 계산 결과를 문장 틀에 넣는다 */
export function SummaryPart({
  series,
  products,
  category,
  search,
  geo,
  geoIsSample,
  tabLabel,
}: {
  series: TrendSnapshot[];
  products: Product[];
  category: string;
  search: SearchSnap[];
  geo: GeoSnap[];
  geoIsSample: boolean;
  tabLabel: Record<MarketTab, string>;
}) {
  const points = keyPoints({ series, products, category, search, geo, geoIsSample });
  if (points.length === 0) return <EmptyState message="이 플랫폼·카테고리의 데이터가 없어요" />;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {points.map((p) => (
          <article key={p.id} className="flex flex-col rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">{p.label}</span>
              {p.sample && <Badge variant="outline">샘플</Badge>}
            </div>
            <p className="mt-1 text-sm font-semibold leading-snug">{p.headline}</p>
            <p className="mt-2 rounded-md bg-muted px-2 py-1.5 text-sm">
              <span className="mr-1 text-xs font-medium text-muted-foreground">할 일</span>
              {p.action}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{p.detail}</p>
            <a href={`#${p.tab}`} className="mt-auto block pt-3 text-xs underline underline-offset-4">
              {tabLabel[p.tab]} 탭 열기 →
            </a>
          </article>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">할 일은 계산 결과로 만든 제안이에요. 최종 판단은 담당자가 해요.</p>
    </div>
  );
}
