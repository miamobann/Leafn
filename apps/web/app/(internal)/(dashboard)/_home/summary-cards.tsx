import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { TabSummary } from "./tab-summary";

/** 홈 진행 표 오른쪽: 탭마다 핵심 숫자 하나를 2×2로. 누르면 그 탭으로 간다. 높이는 옆 진행 표에 맞춰 늘어난다 */
export function SummaryCards({ items }: { items: TabSummary[] }) {
  return (
    <section aria-label="탭별 요약" className="grid grid-cols-2 grid-rows-2 gap-3">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex min-w-0 flex-col justify-center rounded-xl border bg-card px-4 py-2.5 text-card-foreground hover:bg-muted/50"
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
