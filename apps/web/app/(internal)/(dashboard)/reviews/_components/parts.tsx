"use client";

// 리뷰 탭 화면들이 같이 쓰는 작은 부품: 페이지 넘기기, 근거 패널(넓으면 오른쪽 칸, 좁으면 서랍), 리뷰 카드
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { ReviewWithAnalysis } from "@/lib/data/reviews";
import { APPEAL_TOPICS, type AppealTopic } from "@/lib/schemas/review";
import { formatDate } from "@/lib/format";
import { profileLabel, stars } from "../_lib/topics";

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

/** 형광 표시할 말: 이 리뷰의 AI 키워드 중 고른 주제와 같은 분류인 것 + 주제 라벨. 키워드는 원문 그대로 뽑게 되어 있다 (prompts/review-analysis.v1.md) */
export type ReviewHighlight = { topic: AppealTopic; polarity: "positive" | "negative" };

/**
 * 주제별로 리뷰에 자주 나오는 말. AI 키워드가 없거나(가짜 데이터 · 분석 전) 키워드가 짧을 때도 근거 부분이 보이게 한다.
 * 화면 표시용 힌트일 뿐 분류에는 쓰지 않는다. 늘릴 때는 짧고 확실한 말만 넣는다 (애매하면 엉뚱한 곳이 칠해진다)
 */
const CUES: Record<AppealTopic, Record<ReviewHighlight["polarity"], string[]>> = {
  texture: {
    positive: ["산뜻", "흡수", "가볍", "끈적이지 않", "さっぱり", "なじ", "軽い", "べたつかない"],
    negative: ["끈적", "무거", "밀려", "べたつ", "ベタベタ", "重い", "よれ"],
  },
  lasting_moisture: {
    positive: ["촉촉", "보습", "유지", "당김이 없", "오래가", "오래 가", "속건조", "수분", "편안", "しっとり", "保湿", "うるおい", "潤い", "続く"],
    negative: ["건조", "당겨", "당김", "땅기", "乾燥", "物足りない", "つっぱ"],
  },
  irritation: {
    positive: ["순하", "순해", "자극 없", "자극이 없", "低刺激", "しみない", "刺激がな"],
    negative: ["자극", "따가", "트러블", "붉어", "刺激", "ヒリヒリ", "赤み", "しみる"],
  },
  scent: {
    positive: ["향이 좋", "은은", "무향", "향도 거의 없", "いい香り", "無香料"],
    negative: ["향이 강", "향이 진", "향료", "냄새", "香りが強", "匂い"],
  },
  value: {
    positive: ["가성비", "가격이 적당", "저렴", "양이 많", "コスパ", "手頃", "安い", "量が多"],
    negative: ["비싸", "가격 부담", "용량이 작", "금방 써", "高い", "容量が少", "値段"],
  },
  container: {
    positive: ["펌프", "용기가 편", "ポンプ"],
    negative: ["새요", "샜", "뚜껑", "漏れ", "蓋"],
  },
};

function highlightTerms(review: ReviewWithAnalysis, h: ReviewHighlight) {
  const topic = APPEAL_TOPICS[h.topic];
  const keywords = review.analysis?.keywords.filter((k) => k.category === topic.category).map((k) => k.text) ?? [];
  return [...keywords, topic[h.polarity].ko, topic[h.polarity].ja, ...CUES[h.topic][h.polarity]];
}

/**
 * 본문에서 찾은 말을 <mark>로 감싼다. 긴 말부터 찾고, 겹치면 먼저 찾은 것만 남긴다. 못 찾은 말은 그냥 넘어간다.
 * 한국어는 찾은 말 뒤에 붙은 글자까지 한 어절로 칠한다 (촉촉 → 촉촉함이)
 */
function Marked({ text, terms, polarity }: { text: string; terms: string[]; polarity: ReviewHighlight["polarity"] }) {
  const ranges: { start: number; end: number }[] = [];
  for (const term of [...new Set(terms.map((t) => t.trim()).filter(Boolean))].sort((a, b) => b.length - a.length)) {
    for (let at = text.indexOf(term); at >= 0; at = text.indexOf(term, at + term.length)) {
      let end = at + term.length;
      while (end < text.length && /[가-힣]/.test(text[end])) end += 1;
      if (!ranges.some((r) => at < r.end && end > r.start)) ranges.push({ start: at, end });
    }
  }
  if (ranges.length === 0) return <>{text}</>;
  const tone = polarity === "positive" ? "bg-sentiment-positive/15 text-sentiment-positive" : "bg-sentiment-negative/15 text-sentiment-negative";
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const r of ranges.sort((a, b) => a.start - b.start)) {
    if (r.start > cursor) parts.push(text.slice(cursor, r.start));
    parts.push(
      <mark key={r.start} className={`rounded-sm px-0.5 ${tone}`}>
        {text.slice(r.start, r.end)}
      </mark>,
    );
    cursor = r.end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

/**
 * 리뷰 본문. 한국어 번역(body_ko)이 있으면 번역을 보여 주고 "원문 보기"를 누르면 원문을 펼친다.
 * 번역이 아직 없는 일본어 리뷰는 원문을 보여 주고 "번역 전"이라고 알려 준다 (리뷰 화면의 "AI로 분석하기"가 번역도 채운다).
 */
export function ReviewText({
  review,
  marks,
}: {
  review: Pick<ReviewWithAnalysis, "body" | "body_ko" | "lang">;
  /** 주면 보이는 본문 속 해당 말을 형광 표시한다 */
  marks?: { terms: string[]; polarity: ReviewHighlight["polarity"] };
}) {
  const show = (text: string) => (marks ? <Marked text={text} terms={marks.terms} polarity={marks.polarity} /> : text);
  const [showOriginal, setShowOriginal] = useState(false);
  const langName = review.lang === "ja" ? "일본어" : "";
  if (!review.body_ko) {
    return (
      <p lang={review.lang}>
        {show(review.body)}
        {review.lang === "ja" && <span className="ml-1.5 text-xs text-muted-foreground">(번역 전)</span>}
      </p>
    );
  }
  return (
    <div className="space-y-1">
      <p>{show(review.body_ko)}</p>
      <button type="button" aria-expanded={showOriginal} onClick={() => setShowOriginal((v) => !v)} className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        {showOriginal ? `${langName} 원문 접기`.trim() : `${langName} 원문 보기`.trim()}
      </button>
      {showOriginal && (
        <p lang={review.lang} className="rounded-md bg-muted/50 px-2.5 py-1.5 text-muted-foreground">
          {show(review.body)}
        </p>
      )}
    </div>
  );
}

export function ReviewCard({
  review,
  sub,
  highlight,
  children,
}: {
  review: ReviewWithAnalysis;
  sub?: string;
  /** 근거 패널에서 고른 주제. 주면 본문 속 해당 키워드를 형광 표시한다 */
  highlight?: ReviewHighlight;
  children?: React.ReactNode;
}) {
  const terms = highlight ? highlightTerms(review, highlight) : [];
  const who = [profileLabel(review.reviewer_attrs?.age_group), profileLabel(review.reviewer_attrs?.skin_type)].filter(Boolean).join(" · ");
  return (
    <article className="space-y-1.5 rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
        <span className="text-amber-700">{stars(review.rating)}</span>
        {sub && <span lang="ja">{sub}</span>}
        {who && <span>{who}</span>}
        <span>{formatDate(review.posted_at)}</span>
      </div>
      <ReviewText review={review} marks={highlight ? { terms, polarity: highlight.polarity } : undefined} />
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
