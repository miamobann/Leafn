"use client";

// 리뷰 탭 화면들이 같이 쓰는 작은 부품: 페이지 넘기기, 근거 패널(넓으면 오른쪽 칸, 좁으면 서랍), 리뷰 카드
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { ReviewWithAnalysis } from "@/lib/data/reviews";
import { formatDate } from "@/lib/format";
import { stars } from "../_lib/topics";

/** 이동하는 링크는 진한 회색 글자 + →, 밑줄은 마우스를 올렸을 때만 (목업 링크 규칙) */
export const linkClass = "text-sm font-medium text-foreground/80 underline-offset-4 hover:text-foreground hover:underline";

export function paginate<T>(items: T[], page: number, size: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, page), pageCount);
  const start = (current - 1) * size;
  return { rows: items.slice(start, start + size), page: current, pageCount, from: items.length ? start + 1 : 0, to: Math.min(start + size, items.length) };
}

/** 페이지가 많으면 지금 페이지 주변 5개만 보여준다 */
function pageWindow(page: number, pageCount: number, size = 5) {
  const first = Math.max(1, Math.min(page - Math.floor(size / 2), pageCount - size + 1));
  return Array.from({ length: Math.min(size, pageCount) }, (_, i) => first + i);
}

export function Pager({
  page,
  pageCount,
  onChange,
  summary,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  summary: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="text-muted-foreground">{summary}</span>
      {pageCount > 1 && (
        <nav aria-label="페이지" className="ml-auto flex gap-1.5">
          {pageWindow(page, pageCount).map((n) => (
            <button
              key={n}
              type="button"
              aria-current={n === page ? "page" : undefined}
              onClick={() => onChange(n)}
              className={`size-9 rounded-md border text-sm ${n === page ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-muted"}`}
            >
              {n}
            </button>
          ))}
          {page < pageCount && (
            <button type="button" aria-label="다음 페이지" onClick={() => onChange(page + 1)} className="size-9 rounded-md border bg-background text-sm hover:bg-muted">
              ›
            </button>
          )}
        </nav>
      )}
    </div>
  );
}

/** 화면 폭이 xl(1280px) 이상인가. 좁으면 근거 패널을 서랍으로 연다 */
function useWide() {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1280px)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return wide;
}

/**
 * 근거 리뷰 패널. 넓은 화면에서는 오른쪽 칸에 붙어 있고(sticky), 좁은 화면에서는 오른쪽 서랍(Sheet)으로 열린다.
 * 폭이 모자라면 패널이 맨 아래로 밀려 누른 항목과 멀어지기 때문이다 (목업 "좁은 화면")
 */
export function EvidencePanel({
  open,
  picks,
  onClose,
  title,
  children,
}: {
  open: boolean;
  /** 사용자가 항목을 누른 횟수. 좁은 화면에서는 처음 고른 기본 항목으로 서랍이 저절로 열리지 않게, 누른 뒤에만 연다 */
  picks: number;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  const wide = useWide();
  if (!wide) {
    return (
      <Sheet open={open && picks > 0} onOpenChange={(next) => !next && onClose()}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="pr-10">
            <p className="text-xs text-muted-foreground">근거 리뷰</p>
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 px-4 pb-6">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }
  if (!open) return null;
  return (
    <aside className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">근거 리뷰</p>
          <h2 className="text-base font-semibold">{title}</h2>
        </div>
        <button type="button" aria-label="패널 닫기" onClick={onClose} className="rounded-md p-1 hover:bg-muted">
          <X className="size-4" />
        </button>
      </div>
      {children}
    </aside>
  );
}

export function ReviewCard({ review, sub, children }: { review: ReviewWithAnalysis; sub?: string; children?: React.ReactNode }) {
  const who = [review.reviewer_attrs?.age_group, review.reviewer_attrs?.skin_type].filter(Boolean).join(" · ");
  return (
    <article className="space-y-1.5 rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
        <span className="text-amber-700">{stars(review.rating)}</span>
        {sub && <span lang="ja">{sub}</span>}
        {who && <span>{who}</span>}
        <span>{formatDate(review.posted_at)}</span>
      </div>
      <p lang={review.lang}>{review.body}</p>
      {review.body_ko && <p className="text-muted-foreground">{review.body_ko}</p>}
      {children}
    </article>
  );
}

export function SortChips({ value, onChange }: { value: "recent" | "rating"; onChange: (v: "recent" | "rating") => void }) {
  return (
    <div className="flex gap-1.5 text-xs">
      {(
        [
          ["recent", "최신순"],
          ["rating", "별점순"],
        ] as const
      ).map(([key, label]) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={`rounded-full border px-2.5 py-1 ${value === key ? "border-foreground font-medium" : "text-muted-foreground hover:bg-muted"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function sortReviews(reviews: ReviewWithAnalysis[], by: "recent" | "rating") {
  return reviews.toSorted((a, b) => (by === "rating" ? b.rating - a.rating : 0) || b.posted_at.localeCompare(a.posted_at));
}

export function BackTitle({ href, title, children }: { href: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={href} aria-label="리뷰 리포트 목록으로 돌아가기" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
        <ChevronLeft className="size-5" />
      </Link>
      <h1 className="text-2xl font-semibold">{title}</h1>
      {children}
    </div>
  );
}

export function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">{children}</span>;
}

export function ImportButton() {
  return (
    <Link href="/reviews/import" className={buttonVariants({ size: "lg" })}>
      리뷰 가져오기
    </Link>
  );
}

/** 막대 한 줄 (비율 표시). 색만으로 구분하지 않게 숫자를 같이 쓴다 */
export function Meter({ label, value, pct, tone = "neutral" }: { label: React.ReactNode; value: React.ReactNode; pct: number; tone?: "neutral" | "praise" | "complaint" }) {
  const fill = tone === "praise" ? "bg-sky-600" : tone === "complaint" ? "bg-orange-500" : "bg-stone-500";
  return (
    <div className="grid grid-cols-[4.5rem_1fr_3rem] items-center gap-2 text-sm">
      <span className="truncate text-muted-foreground">{label}</span>
      <div className="h-2 rounded-full bg-muted">
        <div className={`h-2 rounded-full ${fill}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-right tabular-nums">{value}</span>
    </div>
  );
}
