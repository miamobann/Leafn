// 요약 탭 「한눈에 보기」 칸의 작은 그래프들 (2026-10-26). 칸마다 데이터 모양에 맞는 그래프를 쓴다:
// 자사 vs 기준값 → 두 막대 · 구성 → 100% 막대 · Top 10 점유 → 칸 그림 · 합 100% 비중 → 도넛 · 니즈 → 영상 점
// 라이브러리 없이 HTML·SVG로 그린다. 위치·길이·색은 값에 따라 정해져 인라인 스타일이 불가피하다
import { cn } from "@/lib/utils";

/** ml당 가격 비교: 자사와 순위권 중앙값을 같은 자로 잰 두 막대 + 순위권 범위 한 줄 */
export function PriceCompare({ min, max, median, own }: { min: number; max: number; median: number; own: { name: string; ppm: number } | null }) {
  const rows = [
    ...(own ? [{ label: "우리 제품", value: own.ppm, strong: true }] : []),
    { label: "순위권 중앙값", value: median, strong: false },
  ];
  return (
    <div className="space-y-2.5">
      <ul className="space-y-2 text-[13px]">
        {rows.map((r) => (
          <li key={r.label} className={cn("grid grid-cols-[5.5rem_minmax(0,1fr)_3.5rem] items-center gap-2.5", r.strong && "font-semibold")}>
            <span>{r.label}</span>
            <span className="block h-3 overflow-hidden rounded-full bg-muted">
              <span className={cn("block h-full rounded-full", r.strong ? "bg-primary" : "bg-neutral-400 dark:bg-neutral-500")} style={{ width: `${Math.round((r.value / max) * 100)}%` }} />
            </span>
            <span className="text-right tabular-nums">{r.value}円</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        순위권 범위 {min}円 ~ {max}円 · 막대가 짧을수록 ml당 싸요
      </p>
    </div>
  );
}

export type Segment = { label: string; value: number; className: string; note?: string };

/** 구성 100% 막대 (조각 사이 2px 틈) + 아래 범례 */
export function StackBar({ segments, total, unit = "개" }: { segments: Segment[]; total: number; unit?: string }) {
  const shown = segments.filter((s) => s.value > 0);
  return (
    <div className="space-y-2.5">
      <div className="flex h-4 gap-0.5 overflow-hidden rounded-full">
        {shown.map((s) => (
          <span key={s.label} title={`${s.label} ${s.value}${unit}`} className={cn("h-full first:rounded-l-full last:rounded-r-full", s.className)} style={{ width: `${(s.value / Math.max(1, total)) * 100}%` }} />
        ))}
      </div>
      <ul className="space-y-1 text-[13px]">
        {segments.map((s) => (
          <li key={s.label} className="grid grid-cols-[12px_minmax(0,1fr)_auto] items-center gap-2">
            <span className={cn("size-3 rounded-[3px]", s.className)} />
            <span className="truncate">
              {s.label}
              {s.note && <span className="ml-1 text-xs text-muted-foreground">{s.note}</span>}
            </span>
            <span className="tabular-nums">
              {s.value}
              {unit}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Top N 칸 그림: 1위 브랜드 칸만 진하게 (순위 순서대로 채움) */
export function Waffle({ cells, leader, leaderCount, others }: { cells: string[]; leader: string; leaderCount: number; others: number }) {
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-5 gap-1.5">
        {cells.map((brand, i) => (
          <span
            key={i}
            title={`${i + 1}위 ${brand}`}
            className={cn(
              "flex aspect-[2/1] items-center justify-center rounded-md text-[11px] tabular-nums",
              brand === leader ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {i + 1}
          </span>
        ))}
      </div>
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 text-foreground">
          <span className="size-2.5 rounded-[3px] bg-primary" />
          <span lang="ja">{leader}</span> {leaderCount}개
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2.5 rounded-[3px] bg-muted ring-1 ring-border" /> 다른 브랜드 {others}곳
        </span>
      </p>
    </div>
  );
}

// 비중 도넛 색: 시장 분석 원형 그래프와 같은 구분색 (색약 검사 통과 5색), 「기타」는 회색
const DONUT_COLORS = ["var(--chart-cat-1)", "var(--chart-cat-2)", "var(--chart-cat-3)", "var(--chart-cat-4)", "var(--chart-cat-5)"];

/** 합 100% 비중 도넛 (작게) + 아래 가로 범례 */
export function MiniDonut({ slices }: { slices: { label: string; share: number }[] }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const total = slices.reduce((s, x) => s + x.share, 0) || 1;
  const colorOf = (label: string, i: number) => (label.startsWith("기타") ? "var(--chart-2)" : DONUT_COLORS[i % DONUT_COLORS.length]);
  let offset = 0;
  return (
    <div className="space-y-2.5">
      <svg viewBox="0 0 110 110" className="mx-auto size-20" role="img" aria-label="성분 검색 관심도 비중">
        {slices.map((s, i) => {
          const len = (s.share / total) * c;
          const seg = (
            <circle
              key={s.label}
              cx="55"
              cy="55"
              r={r}
              fill="none"
              stroke={colorOf(s.label, i)}
              strokeWidth="18"
              strokeDasharray={`${Math.max(0, len - 1.5)} ${c - len + 1.5}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 55 55)"
            >
              <title>{`${s.label} ${s.share}%`}</title>
            </circle>
          );
          offset += len;
          return seg;
        })}
      </svg>
      <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs">
        {slices.map((s, i) => (
          <li key={s.label} className={cn("inline-flex items-center gap-1 whitespace-nowrap", i === 0 && "font-semibold")}>
            <span className="size-2.5 rounded-[3px]" style={{ background: colorOf(s.label, i) }} />
            {s.label} <span className="tabular-nums">{s.share}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 니즈 순위: 니즈마다 영상 수를 점으로 (전체 영상 중 몇 개가 말했는지) */
export function NeedPips({ needs, total }: { needs: { label: string; count: number }[]; total: number }) {
  return (
    <ul className="space-y-2 text-[13px]">
      {needs.map((n, i) => (
        <li key={n.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <span className={cn("truncate", i === 0 && "font-semibold")}>{n.label}</span>
          <span className="flex items-center gap-1" title={`영상 ${total}개 중 ${n.count}개`}>
            {Array.from({ length: total }, (_, k) => (
              <span key={k} className={cn("size-2 rounded-full", k < n.count ? (i === 0 ? "bg-primary" : "bg-neutral-500") : "bg-muted ring-1 ring-border")} />
            ))}
            <span className="ml-1 w-8 text-right text-xs tabular-nums text-muted-foreground">
              {n.count}/{total}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** 순위 막대: 1위만 진하게, 오른쪽에 횟수 (AI 검색 키워드) */
export function RankBars({ rows, unit }: { rows: { label: string; sub?: string | null; count: number }[]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ol className="space-y-2 text-[13px]">
      {rows.map((r, i) => (
        <li key={r.label} className={cn("grid grid-cols-[1rem_minmax(0,9rem)_minmax(0,1fr)_3.5rem] items-center gap-2", i === 0 && "font-semibold")}>
          <span className="text-muted-foreground tabular-nums">{i + 1}</span>
          <span className="min-w-0 truncate" title={r.sub ? `${r.label} · ${r.sub}` : r.label}>
            <span lang="ja">{r.label}</span>
            {r.sub && <span className="ml-1 text-xs font-normal text-muted-foreground">{r.sub}</span>}
          </span>
          <span className="block h-2.5 overflow-hidden rounded-full bg-muted">
            <span className={cn("block h-full rounded-full", i === 0 ? "bg-primary" : "bg-neutral-400 dark:bg-neutral-500")} style={{ width: `${Math.round((r.count / max) * 100)}%` }} />
          </span>
          <span className="text-right tabular-nums">
            {r.count}
            {unit}
          </span>
        </li>
      ))}
    </ol>
  );
}
