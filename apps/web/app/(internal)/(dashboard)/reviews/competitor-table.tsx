"use client";

// 리뷰 리포트 목록의 경쟁 제품 표: 검색 · 종류 · 플랫폼 · 정렬, 10개씩 페이지, 리뷰 없는 제품은 맨 아래 한 줄로 접는다
import Link from "next/link";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { paginate, Pager } from "./_components/parts";

export type CompetitorRow = {
  id: string;
  /** 원문 제품명 (브랜드 + 제목). 검색과 툴팁에 쓴다 */
  name: string;
  /** AI가 정리한 짧은 제목 (정리 전이면 원문과 같다) */
  title: string;
  /** 한국어 캡션. 정리 전이면 null */
  caption: string | null;
  category: string;
  platform: string;
  rank: number | null;
  count: number;
  pain: string | null;
  candidates: number;
};

type Sort = "candidates" | "rank" | "count";
const PAGE_SIZE = 10;
const selectClass = "h-9 rounded-md border bg-background px-2 text-sm";

export function CompetitorTable({ rows }: { rows: CompetitorRow[] }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [platform, setPlatform] = useState("");
  const [sort, setSort] = useState<Sort>("candidates");
  const [page, setPage] = useState(1);
  const [showEmpty, setShowEmpty] = useState(false);

  const categories = [...new Set(rows.map((r) => r.category))];
  const platforms = [...new Set(rows.map((r) => r.platform))];
  const filtered = useMemo(
    () =>
      rows
        .filter((r) => !q || `${r.name} ${r.caption ?? ""}`.toLowerCase().includes(q.toLowerCase()))
        .filter((r) => !category || r.category === category)
        .filter((r) => !platform || r.platform === platform),
    [rows, q, category, platform],
  );
  const byRank = (a: CompetitorRow, b: CompetitorRow) => (a.rank ?? 999) - (b.rank ?? 999);
  const withReviews = filtered
    .filter((r) => r.count > 0)
    .toSorted((a, b) => (sort === "candidates" ? b.candidates - a.candidates : sort === "count" ? b.count - a.count : 0) || byRank(a, b));
  const empty = filtered.filter((r) => r.count === 0).toSorted(byRank);
  const paged = paginate(withReviews, page, PAGE_SIZE);
  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-lg font-semibold">경쟁 제품</h2>
        <span className="text-sm text-muted-foreground">{rows.length}개 · 일본 리뷰 기준 · 별점 1~3점만 수집</span>
      </div>
      <div className="flex flex-wrap items-end gap-2.5 rounded-xl border bg-card px-4 py-3">
        <label className="flex min-w-56 flex-1 flex-col gap-1 text-xs text-muted-foreground">
          제품 검색
          <Input type="search" placeholder="제품명이나 브랜드" value={q} onChange={(e) => reset(() => setQ(e.target.value))} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          종류
          <select className={selectClass} value={category} onChange={(e) => reset(() => setCategory(e.target.value))}>
            <option value="">전체</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          플랫폼
          <select className={selectClass} value={platform} onChange={(e) => reset(() => setPlatform(e.target.value))}>
            <option value="">전체</option>
            {platforms.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          정렬
          <select className={selectClass} value={sort} onChange={(e) => reset(() => setSort(e.target.value as Sort))}>
            <option value="candidates">소구점 후보 많은 순</option>
            <option value="rank">순위 높은 순</option>
            <option value="count">리뷰 많은 순</option>
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-5 py-3 font-medium">제품</th>
              <th className="w-28 px-2 py-3 font-medium">순위</th>
              <th className="w-20 px-2 py-3 font-medium">리뷰</th>
              <th className="px-2 py-3 font-medium">가장 큰 불만</th>
              <th className="w-36 py-3 pr-5 pl-2 font-medium">우리 제품과</th>
            </tr>
          </thead>
          <tbody>
            {paged.rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                <td className="px-5 py-3">
                  <Link href={`/reviews/${r.id}`} lang="ja" title={r.name} className="font-medium underline-offset-4 hover:underline">
                    {r.title}
                  </Link>
                  {r.caption && <p className="text-sm text-muted-foreground">{r.caption}</p>}
                  <p className="text-xs text-muted-foreground">
                    {r.category} · {r.platform}
                  </p>
                </td>
                <td className="px-2 py-3 text-muted-foreground">{r.rank ? `${r.category} ${r.rank}위` : "—"}</td>
                <td className="px-2 py-3">{r.count}건</td>
                <td className="px-2 py-3">{r.pain ?? <span className="text-muted-foreground">분석 전</span>}</td>
                <td className="py-3 pr-5 pl-2">
                  <span
                    className={`rounded-md border px-2 py-0.5 text-xs whitespace-nowrap ${r.candidates > 0 ? "border-sky-200 text-sky-900" : "text-muted-foreground"}`}
                  >
                    {r.candidates > 0 ? `소구점 후보 ${r.candidates}` : "후보 없음"}
                  </span>
                </td>
              </tr>
            ))}
            {paged.rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-muted-foreground">
                  조건에 맞는 경쟁 제품이 없어요
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="border-t px-5 py-3">
          <Pager page={paged.page} pageCount={paged.pageCount} onChange={setPage} summary={`리뷰 있는 ${withReviews.length}개 중 ${paged.from}~${paged.to}`} />
        </div>
      </div>

      {empty.length > 0 && (
        <div className="rounded-xl border border-dashed bg-card">
          <button
            type="button"
            aria-expanded={showEmpty}
            onClick={() => setShowEmpty((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-3.5 text-left text-sm"
          >
            <span>
              리뷰가 아직 없는 경쟁 제품 {empty.length}개{" "}
              <span className="text-muted-foreground">
                · {empty.slice(0, 3).map((r) => r.name.split(" ")[0]).join(", ")}
                {empty.length > 3 && ` 외 ${empty.length - 3}개`}
              </span>
            </span>
            <span className="font-medium text-foreground/80">{showEmpty ? "접기 ⌃" : "펼치기 ⌄"}</span>
          </button>
          {showEmpty && (
            <ul className="space-y-1 border-t px-5 py-3 text-sm text-muted-foreground">
              {empty.map((r) => (
                <li key={r.id} lang="ja">
                  {r.rank ? `${r.rank}위 · ` : ""}
                  <span title={r.name}>{r.title}</span> <span className="text-xs">({r.category} · {r.platform})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">한 번에 10개씩 보여주고, 소구점 후보가 많은 제품이 위로 와요.</p>
    </section>
  );
}
