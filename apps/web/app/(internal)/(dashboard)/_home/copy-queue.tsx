// 홈 현황판 오른쪽의 초록 카드: 팀장 승인을 기다리는 광고 문구 (2026-10-26 홈 새 디자인)
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { Risk } from "@/lib/schemas/common";

const TEXT = {
  title: "문구 검토 대기",
  unit: "건 · 팀장 승인 필요",
  empty: "검토를 기다리는 문구가 없어요",
  history: "검토 이력 보기",
  more: (n: number) => `외 ${n}건 더 보기 →`,
  risk: { high: "위험 높음", medium: "위험 중간", low: "위험 낮음" } satisfies Record<Risk, string>,
};

// 카드에 바로 보이는 문구 수. 위험이 높은 것부터. 옆 현황판보다 길어지면 아래 캘린더가 첫 화면에서 밀려나서 2개로 둔다
const SHOWN = 2;
const RISK_ORDER: Record<Risk, number> = { high: 0, medium: 1, low: 2 };

export type QueuedCopy = {
  id: string;
  text: string;
  lang: "ko" | "ja";
  /** 제품 이름 또는 용도 (예: "Deep Skin", "배너") */
  where: string | null;
  risk: Risk | null;
  createdAt: string;
};

export function CopyQueue({ items }: { items: QueuedCopy[] }) {
  const sorted = items.toSorted((a, b) => RISK_ORDER[a.risk ?? "low"] - RISK_ORDER[b.risk ?? "low"] || b.createdAt.localeCompare(a.createdAt));

  return (
    <section
      aria-labelledby="copy-queue-title"
      className="flex min-w-0 flex-[1_1_300px] flex-col gap-3 rounded-xl bg-primary px-6 py-5 text-primary-foreground"
    >
      <div className="flex items-center gap-3">
        <h2 id="copy-queue-title" className="text-lg font-medium">
          {TEXT.title}
        </h2>
        <Link
          href="/ad-check/history"
          aria-label={TEXT.history}
          className="ml-auto inline-flex size-9 items-center justify-center rounded-full border border-primary-foreground/40 hover:bg-primary-foreground/10"
        >
          <ArrowUpRight aria-hidden className="size-4" />
        </Link>
      </div>
      <p className="flex items-baseline gap-2.5">
        <span className="text-5xl leading-none font-light tabular-nums">{items.length}</span>
        <span className="text-sm text-[#d4e6d9]">{TEXT.unit}</span>
      </p>
      {sorted.length === 0 ? (
        <p className="text-sm text-[#d4e6d9]">{TEXT.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.slice(0, SHOWN).map((c) => (
            <li key={c.id}>
              <Link href={`/ad-check/${c.id}`} className="flex flex-col gap-0.5 rounded-2xl bg-primary-foreground/12 px-3.5 py-2.5 hover:bg-primary-foreground/20">
                <span lang={c.lang} className="truncate font-medium">
                  {c.text}
                </span>
                <span className="text-xs text-[#d4e6d9]">
                  {[c.where, c.risk ? TEXT.risk[c.risk] : null, c.createdAt.slice(5, 10)].filter(Boolean).join(" · ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {sorted.length > SHOWN && (
        <Link href="/ad-check/history" className="text-sm font-medium hover:underline">
          {TEXT.more(sorted.length - SHOWN)}
        </Link>
      )}
    </section>
  );
}
