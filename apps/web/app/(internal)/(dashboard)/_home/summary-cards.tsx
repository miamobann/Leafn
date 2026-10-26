import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { TabSummary } from "./tab-summary";

/** 홈 현황판 오른쪽: 탭마다 핵심 숫자 하나를 2×2로. 누르면 그 탭으로 간다. 높이는 옆 현황판에 맞춰 늘어난다 */
export function SummaryCards({ items }: { items: TabSummary[] }) {
  return (
    <section aria-label="탭별 요약" className="grid grid-cols-2 grid-rows-2 gap-3">
      {items.map((item) => (
        // data-slot="card"·ring-1: 공통 카드(components/ui/card.tsx)와 같은 테두리, leaf 테마에서는 같은 그림자 (globals.css)
        <Link
          key={item.href}
          href={item.href}
          data-slot="card"
          className="flex min-w-0 flex-col justify-center rounded-xl bg-card px-4 py-2.5 text-card-foreground ring-1 ring-foreground/10 hover:bg-muted/50"
        >
          <span className="flex justify-between gap-2 text-xs text-muted-foreground">
            <span className="truncate">
              {item.tab} · {item.label}
            </span>
            <ArrowRight aria-hidden className="size-3.5 shrink-0" />
          </span>
          <span lang={item.lang} className="text-xl font-semibold">
            {item.value}
          </span>
          <span className="truncate text-xs text-muted-foreground">{item.sub}</span>
        </Link>
      ))}
    </section>
  );
}
