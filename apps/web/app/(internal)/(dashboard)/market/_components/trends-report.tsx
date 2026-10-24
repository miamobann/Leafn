"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReportTemplate } from "@/components/templates";
import { formatDate, formatJpy } from "@/lib/format";
import type { Product } from "@/lib/schemas/product";
import type { TrendSnapshot } from "@/lib/schemas/trend";
import {
  DYNAMICS_TOP_N,
  latestRanking,
  MARKET_CATEGORIES,
  OWN_BRAND,
  PROMO_HOOK_LABEL,
  TOP_N,
  type RankRow,
} from "@/app/(internal)/(dashboard)/market/_lib/market";
import { RankingDynamics } from "@/app/(internal)/(dashboard)/market/_components/ranking-dynamics";
import { ToggleGroup } from "@/app/(internal)/(dashboard)/market/_components/toggle-group";

type Category = (typeof MARKET_CATEGORIES)[number];

function Change({ row }: { row: RankRow }) {
  if (row.prevRank === null) return <span className="text-xs text-muted-foreground">NEW</span>;
  const d = row.prevRank - row.rank;
  if (d > 0) return <span className="text-xs font-medium text-risk-low">▲ {d}</span>;
  if (d < 0) return <span className="text-xs font-medium text-risk-high">▼ {-d}</span>;
  return <span className="text-xs text-muted-foreground">–</span>;
}

/** 상세 이미지에서 뽑은 소구 성분·프로모션 (분석 전이면 —). 배지에 마우스를 올리면 원문 문구 */
function Appeal({ row }: { row: RankRow }) {
  if (!row.appeal) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {row.appeal.hero_ingredients.map((h) => (
        <Badge key={h.canonical} variant="outline" title={h.evidence_ja}>
          <span lang="ja">{h.name_ja}</span>
        </Badge>
      ))}
      {row.appeal.promo_hooks.map((h) => (
        <Badge key={h.text_ja} variant="secondary" title={h.text_ja}>
          {PROMO_HOOK_LABEL[h.type]}
        </Badge>
      ))}
    </span>
  );
}

function ProductName({ row }: { row: RankRow }) {
  const label = (
    <>
      <span className="font-medium">{row.brand}</span> <span lang="ja">{row.name}</span>
    </>
  );
  return row.productId ? (
    <Link href={`/market/competitors/${row.productId}`} className="underline-offset-4 hover:underline">
      {label}
    </Link>
  ) : (
    label
  );
}

export function TrendsReport({ snapshots, products }: { snapshots: TrendSnapshot[]; products: Product[] }) {
  const [category, setCategory] = useState<Category>("化粧水");

  const ranking = latestRanking(snapshots, category, products);
  const top = ranking.filter((r) => r.rank <= TOP_N);
  const latest = snapshots.filter((s) => s.category === category).at(-1);
  const risers = ranking
    .filter((r) => r.prevRank !== null && r.prevRank > r.rank)
    .toSorted((a, b) => (b.prevRank ?? 0) - b.rank - ((a.prevRank ?? 0) - a.rank))
    .slice(0, 5);
  const ownRows = MARKET_CATEGORIES.flatMap((c) => latestRanking(snapshots, c, products).filter((r) => r.brand === OWN_BRAND).map((r) => ({ ...r, category: c })));

  return (
    <ReportTemplate
      filters={<ToggleGroup label="카테고리" options={MARKET_CATEGORIES} value={category} onChange={setCategory} />}
      cards={[
        {
          title: `랭킹 역동성 · 고인물 vs 뉴페이스 (Top ${DYNAMICS_TOP_N}) · ${category}`,
          wide: true,
          content: <RankingDynamics snapshots={snapshots} category={category} />,
        },
        {
          title: `이번 주 랭킹 TOP ${TOP_N} · ${category}`,
          content: (
            <>
              <p className="mb-2 text-xs text-muted-foreground">{latest ? `${formatDate(latest.captured_at)} 기준` : "—"} · 제품 이름을 누르면 제품 상세 · 소구 포인트 = 상세 이미지 분석 (샘플, 化粧水만)</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>순위</TableHead>
                    <TableHead>변동</TableHead>
                    <TableHead>제품</TableHead>
                    <TableHead>소구 포인트</TableHead>
                    <TableHead className="text-right">税込</TableHead>
                    <TableHead className="text-right">리뷰</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {top.map((r) => (
                    <TableRow key={r.rank}>
                      <TableCell className="font-semibold">{r.rank}</TableCell>
                      <TableCell>
                        <Change row={r} />
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex flex-wrap items-center gap-1">
                          <ProductName row={r} />
                          {r.brand === OWN_BRAND && <Badge>자사</Badge>}
                          {r.is_kbeauty && <Badge variant="secondary">K-뷰티</Badge>}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Appeal row={r} />
                      </TableCell>
                      <TableCell className="text-right">{formatJpy(r.price_jpy)}</TableCell>
                      <TableCell className="text-right">{r.review_count.toLocaleString("ko-KR")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          ),
        },
        {
          title: `급상승 · ${category}`,
          content: (
            <div className="space-y-6">
              <ul className="space-y-2 text-sm">
                {risers.length === 0 && <li className="text-muted-foreground">이번 주 순위가 오른 제품이 없어요</li>}
                {risers.map((r) => (
                  <li key={r.rank} className="flex items-center justify-between gap-2">
                    <span className="inline-flex flex-wrap items-center gap-1">
                      <ProductName row={r} />
                      {r.brand === OWN_BRAND && <Badge>자사</Badge>}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {r.prevRank}위 → {r.rank}위 <Change row={r} />
                    </span>
                  </li>
                ))}
              </ul>
              <div>
                <p className="mb-2 text-sm font-medium">자사 제품 순위</p>
                <ul className="space-y-2 text-sm">
                  {ownRows.length === 0 && <li className="text-muted-foreground">楽天 랭킹에 오른 자사 제품이 없어요</li>}
                  {ownRows.map((r) => (
                    <li key={`${r.category}-${r.name}`} className="flex items-center justify-between gap-2">
                      <span>
                        <ProductName row={r} /> <span lang="ja" className="text-xs text-muted-foreground">{r.category}</span>
                      </span>
                      <span className="shrink-0">
                        <span className="font-semibold">{r.rank}위</span> <Change row={r} />
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">Qoo10·@cosme 판매 제품은 楽天 랭킹에 나오지 않아요</p>
              </div>
            </div>
          ),
        },
      ]}
    />
  );
}
