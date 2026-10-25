"use client";

// 리뷰 원문 목록: 리포트에서 가져온 필터 + 검색 · 감성 · 별점 · 피부타입 · 정렬, 고른 리뷰를 상세페이지용으로 보내기 · CSV 내보내기
import Link from "next/link";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { SentimentBadge } from "@/components/common/badges";
import { buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { ReviewWithAnalysis } from "@/lib/data/reviews";
import type { Sentiment } from "@/lib/schemas/common";
import type { AppealTopic } from "@/lib/schemas/review";
import { formatDate } from "@/lib/format";
import { BackTitle, paginate, Pager } from "../../_components/parts";
import { hasTopic, periodOf, type Polarity, stars, topicLabel } from "../../_lib/topics";

const PAGE_SIZE = 20;
const selectClass = "h-9 rounded-md border bg-background px-2 text-sm text-foreground";
type Sort = "recent" | "high" | "low";

function toCsv(reviews: ReviewWithAnalysis[]) {
  const cell = (v: string | number | undefined) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const head = ["작성일", "별점", "본문", "본문(한국어)", "연령대", "피부타입", "감성"].map(cell).join(",");
  const rows = reviews.map((r) =>
    [formatDate(r.posted_at), r.rating, r.body, r.body_ko, r.reviewer_attrs?.age_group, r.reviewer_attrs?.skin_type, r.analysis?.sentiment].map(cell).join(","),
  );
  return [head, ...rows].join("\n");
}

export function ReviewListView({
  product,
  reviews,
  from,
}: {
  product: { id: string; brand: string; name: string; kind: "own" | "competitor" };
  reviews: ReviewWithAnalysis[];
  from: { topic: AppealTopic; polarity: Polarity } | null;
}) {
  const [topic, setTopic] = useState(from);
  const [q, setQ] = useState("");
  const [sentiment, setSentiment] = useState<Sentiment | "">("");
  const [band, setBand] = useState<"" | "high" | "low">("");
  const [skin, setSkin] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const skins = [...new Set(reviews.flatMap((r) => (r.reviewer_attrs?.skin_type ? [r.reviewer_attrs.skin_type] : [])))];
  const filtered = useMemo(
    () =>
      reviews
        .filter((r) => !topic || hasTopic(r, topic.topic, topic.polarity))
        .filter((r) => !q || r.body.includes(q) || (r.body_ko?.includes(q) ?? false))
        .filter((r) => !sentiment || r.analysis?.sentiment === sentiment)
        .filter((r) => !band || (band === "high" ? r.rating >= 4 : r.rating <= 3))
        .filter((r) => !skin || r.reviewer_attrs?.skin_type === skin)
        .toSorted((a, b) => (sort === "high" ? b.rating - a.rating : sort === "low" ? a.rating - b.rating : 0) || b.posted_at.localeCompare(a.posted_at)),
    [reviews, topic, q, sentiment, band, skin, sort],
  );
  const paged = paginate(filtered, page, PAGE_SIZE);
  const change = (fn: () => void) => {
    fn();
    setPage(1);
  };
  const resetAll = () =>
    change(() => {
      setTopic(null);
      setQ("");
      setSentiment("");
      setBand("");
      setSkin("");
    });
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const pageIds = paged.rows.map((r) => r.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => picked.has(id));
  const pickedKo = reviews.filter((r) => picked.has(r.id) && r.lang === "ko");

  const exportCsv = () => {
    const blob = new Blob(["﻿" + toCsv(reviews.filter((r) => picked.has(r.id)))], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `reviews-${product.id}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const lang = product.kind === "own" ? "국내" : "일본";
  const title = product.kind === "own" ? product.name : `${product.brand} ${product.name}`;

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <BackTitle href={`/reviews/${product.id}`} title={`${title} · 리뷰 원문`} />
        <p className="pl-8 text-sm text-muted-foreground">
          {lang} 리뷰 {reviews.length}건{periodOf(reviews) && ` · ${periodOf(reviews)}`}
        </p>
      </header>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-end gap-2.5">
          <label className="flex min-w-56 flex-1 flex-col gap-1 text-xs text-muted-foreground">
            본문 검색
            <Input type="search" placeholder="예: 펌프, 당김" value={q} onChange={(e) => change(() => setQ(e.target.value))} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            감성
            <select className={selectClass} value={sentiment} onChange={(e) => change(() => setSentiment(e.target.value as Sentiment | ""))}>
              <option value="">전체</option>
              <option value="positive">긍정</option>
              <option value="neutral">중립</option>
              <option value="negative">부정</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            별점
            <select className={selectClass} value={band} onChange={(e) => change(() => setBand(e.target.value as "" | "high" | "low"))}>
              <option value="">전체</option>
              <option value="high">4~5점</option>
              <option value="low">1~3점</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            피부타입
            <select className={selectClass} value={skin} onChange={(e) => change(() => setSkin(e.target.value))}>
              <option value="">전체</option>
              {skins.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            정렬
            <select className={selectClass} value={sort} onChange={(e) => change(() => setSort(e.target.value as Sort))}>
              <option value="recent">최신순</option>
              <option value="high">별점 높은순</option>
              <option value="low">별점 낮은순</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-sm">
          {topic && (
            <>
              <span className="text-xs text-muted-foreground">리포트에서 가져온 필터</span>
              <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs">
                {topic.polarity === "positive" ? "칭찬" : "불만"} · {topicLabel(topic.topic, topic.polarity)}
                <button type="button" aria-label="필터 지우기" onClick={() => change(() => setTopic(null))}>
                  <X className="size-3" />
                </button>
              </span>
            </>
          )}
          <span>
            <b>{filtered.length}건</b> <span className="text-muted-foreground">/ 전체 {reviews.length}건</span>
          </span>
          <button type="button" onClick={resetAll} className="ml-auto text-sm font-medium text-foreground/80 hover:underline">
            필터 초기화
          </button>
        </div>
      </section>

      {picked.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/40 px-4 py-2.5 text-sm">
          <span className="font-medium">{picked.size}건 선택됨</span>
          {product.kind === "own" && pickedKo.length > 0 && (
            <Link href={`/reviews/${product.id}/translate?pick=${pickedKo.map((r) => r.id).join(",")}`} className={buttonVariants({ size: "sm" })}>
              상세페이지용 리뷰로 보내기
            </Link>
          )}
          <button type="button" onClick={exportCsv} className={buttonVariants({ variant: "outline", size: "sm" })}>
            CSV로 내보내기
          </button>
          <button type="button" onClick={() => setPicked(new Set())} className="ml-auto text-sm text-muted-foreground hover:underline">
            선택 해제
          </button>
        </div>
      )}

      <section className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="w-10 py-3 pl-4">
                <Checkbox
                  aria-label="이 페이지 모두 선택"
                  checked={allOnPage}
                  onCheckedChange={(on) =>
                    setPicked((prev) => {
                      const next = new Set(prev);
                      for (const id of pageIds) {
                        if (on) next.add(id);
                        else next.delete(id);
                      }
                      return next;
                    })
                  }
                />
              </th>
              <th className="w-28 px-2 py-3 font-medium">작성일</th>
              <th className="w-24 px-2 py-3 font-medium">별점</th>
              <th className="px-2 py-3 font-medium">본문</th>
              <th className="w-32 px-2 py-3 font-medium">작성자</th>
              <th className="w-20 py-3 pr-4 pl-2 font-medium">감성</th>
            </tr>
          </thead>
          <tbody>
            {paged.rows.map((r) => (
              <tr key={r.id} className={`border-b align-top last:border-0 ${picked.has(r.id) ? "bg-muted/40" : ""}`}>
                <td className="py-3 pl-4">
                  <Checkbox aria-label="이 리뷰 선택" checked={picked.has(r.id)} onCheckedChange={() => toggle(r.id)} />
                </td>
                <td className="px-2 py-3 text-muted-foreground">{formatDate(r.posted_at)}</td>
                <td className="px-2 py-3 text-amber-700">{stars(r.rating)}</td>
                <td className="px-2 py-3">
                  <p lang={r.lang}>{r.body}</p>
                  {r.body_ko && <p className="text-muted-foreground">{r.body_ko}</p>}
                </td>
                <td className="px-2 py-3 text-muted-foreground">{[r.reviewer_attrs?.age_group, r.reviewer_attrs?.skin_type].filter(Boolean).join(" · ") || "—"}</td>
                <td className="py-3 pr-4 pl-2">{r.analysis ? <SentimentBadge sentiment={r.analysis.sentiment} /> : "—"}</td>
              </tr>
            ))}
            {paged.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  조건에 맞는 리뷰가 없어요
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="border-t px-4 py-3">
          <Pager page={paged.page} pageCount={paged.pageCount} onChange={setPage} summary={`${filtered.length}건 중 ${paged.from}~${paged.to}`} />
        </div>
      </section>
    </div>
  );
}
