"use client";

import type { SnsPattern, SnsVideoNote } from "@/lib/schemas/market";
import type { SearchSnap } from "@/lib/schemas/search";
import type { TrendSnapshot } from "@/lib/schemas/trend";
import { PROMO_HOOK_LABEL, TOP_N } from "@/app/(internal)/(dashboard)/market/_lib/market";
import { entryConditions } from "@/app/(internal)/(dashboard)/market/_lib/overview";
import { AUTOCOMPLETE_STATUS_LABEL, autocompleteChanges, commonPatterns } from "@/app/(internal)/(dashboard)/market/_lib/demand";

// 요약은 AI로 쓰지 않는다. 아래 섹션의 계산 결과를 정해진 문장 틀에 넣는다
type Line = { id: string; label: string; go: string; target: string; text: string | null; empty: string };

/** 이번 주 핵심: 공급 · 수요 한 줄씩. 누르면 해당 섹션으로 이동한다 */
export function SummaryPart({
  series,
  sameSource,
  category,
  search,
  snsNotes,
  snsPatterns,
}: {
  series: TrendSnapshot[];
  sameSource: TrendSnapshot[];
  category: string;
  search: SearchSnap[];
  snsNotes: SnsVideoNote[];
  snsPatterns: SnsPattern[];
}) {
  const conditions = entryConditions(series, sameSource);
  const supply = conditions
    ? [conditions.promo ? `Top ${TOP_N} 중 ${PROMO_HOOK_LABEL[conditions.promo.type]} ${conditions.promo.count}/${TOP_N}` : null, conditions.ppm ? `ml당 실질 단가 중앙값 ${conditions.ppm.median}円` : null]
        .filter(Boolean)
        .join(" · ")
    : null;

  const auto = autocompleteChanges(search, category).rows.find((r) => r.status === "new") ?? autocompleteChanges(search, category).rows.find((r) => r.status === "up");
  const expression = commonPatterns(snsPatterns, snsNotes.filter((n) => n.category === category), category).find((p) => p.kind === "expression");
  const demand = auto
    ? `자동완성 ${AUTOCOMPLETE_STATUS_LABEL[auto.status]} 「${auto.term}」${auto.ko ? `(${auto.ko})` : ""}`
    : expression?.label_ja
      ? `SNS 공통 표현 「${expression.label_ja}」`
      : null;

  const lines: Line[] = [
    { id: "supply", label: "공급", go: "공급으로", target: "#supply", text: supply, empty: "랭킹 데이터가 없어요" },
    { id: "demand", label: "수요", go: "수요로", target: "#demand", text: demand, empty: "새로 뜨는 검색어·공통 표현이 없어요" },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {lines.map((l) => (
        <a key={l.id} href={l.target} className="block rounded-lg border bg-card p-3 hover:bg-muted">
          <span className="text-xs font-medium text-muted-foreground">{l.label}</span>
          <span className="mt-1 block text-sm font-medium">
            {l.text ?? <span className="text-muted-foreground">{l.empty}</span>}
          </span>
          <span className="mt-2 block text-xs underline underline-offset-4">{l.go} →</span>
        </a>
      ))}
    </div>
  );
}
