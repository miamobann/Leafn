"use client";

import Link from "next/link";
import { LangBadge } from "@/components/common/badges";
import { EvidenceSheet } from "@/components/common/evidence-sheet";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatJpy } from "@/lib/format";
import { APPEAL_TAGS } from "@/lib/market-config";
import type { Product } from "@/lib/schemas/product";
import { INGREDIENT_MATCH, PROMO_HOOK_LABEL } from "@/app/(internal)/(dashboard)/market/_lib/market";
import { ownDiff, rankingKey, type OverviewRow } from "@/app/(internal)/(dashboard)/market/_lib/overview";

/** 오른쪽 패널에 띄울 내용: 제품 요약, 근거 제품 목록, 근거 원문(자동완성·영상 메모) */
export type PanelContent =
  | { kind: "product"; row: OverviewRow }
  | { kind: "list"; title: string; description?: string; rows: { row: OverviewRow; note?: string }[] }
  | {
      kind: "quotes";
      title: string;
      description?: string;
      quotes: { ja: string; ko?: string; note?: string; href?: string }[];
      footnote?: string;
      link?: { href: string; label: string };
      /** 원문 아래에 붙이는 관련 제품 목록 (예: Top 10에서 이 키워드를 쓴 제품) */
      rows?: { title: string; items: { row: OverviewRow; note?: string }[] };
    };

/** 랭킹에서 골라 경쟁제품 탭으로 가져갈 수 있는 수 (20위까지 전부). 나란히 비교는 경쟁제품 탭에서 4개까지 */
export const MAX_COMPARE = 20;

/** 전주 대비 순위 변동. 색만으로 구분하지 않게 기호를 함께 쓴다 */
export function RankChange({ row }: { row: Pick<OverviewRow, "rank" | "prevRank"> }) {
  if (row.prevRank === null) return <Badge variant="outline">NEW</Badge>;
  const d = row.prevRank - row.rank;
  if (d > 0) return <span className="text-xs font-medium text-risk-low">▲ {d}</span>;
  if (d < 0) return <span className="text-xs font-medium text-risk-high">▼ {-d}</span>;
  return <span className="text-xs text-muted-foreground">– 유지</span>;
}

/** 상품명 원문 + 한국어 해석 */
export function ProductLabel({ row }: { row: Pick<OverviewRow, "brand" | "name" | "name_ko"> }) {
  return (
    <span className="block min-w-0">
      <span className="font-medium">{row.brand}</span> <span lang="ja">{row.name}</span>
      {row.name_ko && <span className="block text-xs text-muted-foreground">{row.name_ko}</span>}
    </span>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b py-1.5 text-sm last:border-b-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function ProductSummary({ row, own, selected, onToggleCompare }: { row: OverviewRow; own: Product | null; selected: string[]; onToggleCompare: (id: string) => void }) {
  const diff = own ? ownDiff(row, own) : null;
  const key = rankingKey(row);
  const inCompare = selected.includes(key);
  const compareFull = !inCompare && selected.length >= MAX_COMPARE;

  return (
    <>
      <section>
        <h3 className="mb-1 text-sm font-semibold">랭킹 정보</h3>
        <Fact label="순위">
          {row.rank}위 {!row.hasPrev ? null : row.prevRank !== null ? <span className="text-muted-foreground">(전주 {row.prevRank}위)</span> : <span className="text-muted-foreground">(전주 20위 밖)</span>}
        </Fact>
        <Fact label="K-뷰티">{row.is_kbeauty ? "예" : "아니오"}</Fact>
        <Fact label="판매가 (税込, 정가)">{formatJpy(row.price_jpy)}</Fact>
        {row.sale_price_jpy != null && (
          <Fact label="할인 적용가">
            {formatJpy(row.sale_price_jpy)} {row.discount_rate != null && <span className="text-muted-foreground">({row.discount_rate}% 할인)</span>}
          </Fact>
        )}
        <Fact label="용량">
          {row.volume_ml ? `${row.volume_ml}ml` : "—"}
          {row.extra_volume_ml ? <span className="block text-xs text-muted-foreground">+ 같은 제품 {row.extra_volume_ml}ml</span> : null}
        </Fact>
        <Fact label="ml당 가격 (정가)">{row.ppm !== null ? `${row.ppm}円` : "—"}</Fact>
        <Fact label="평점 · 리뷰">
          {row.rating != null ? `${row.rating.toFixed(1)} / ${row.rating_scale ?? 5}` : "—"} · {row.review_count !== null ? `${row.review_count.toLocaleString("ko-KR")}건` : "리뷰 수 없음"}
        </Fact>
        <Fact label="프로모션">
          {row.promo_type ? (
            <>
              {PROMO_HOOK_LABEL[row.promo_type]} <span lang="ja" className="block text-xs text-muted-foreground">{row.promo_text}</span>
            </>
          ) : (
            "—"
          )}
        </Fact>
        {row.key_ingredients_ko && <Fact label="핵심 성분 (수집값)">{row.key_ingredients_ko}</Fact>}
        <Fact label="수상·배지">{(row.badges ?? []).length > 0 ? <span lang="ja">{row.badges?.join(" · ")}</span> : "—"}</Fact>
      </section>

      <section>
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
          상품명·설명 원문 <LangBadge lang="ja" />
        </h3>
        <p lang="ja" className="rounded-md bg-muted p-2 text-sm">
          {row.name}
          <br />
          {row.description_ja ?? "설명 없음"}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">사전에서 찾은 값 (원문 표기)</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {row.ingredients.map((x) => (
            <Badge key={x.ingredient} variant="outline">
              성분 {INGREDIENT_MATCH[x.ingredient]?.ko ?? x.ingredient} · <span lang="ja">{x.matched}</span>
            </Badge>
          ))}
          {row.tags.map((t) => (
            <Badge key={t.tag} variant="secondary">
              소구 {APPEAL_TAGS[t.tag]?.ko ?? t.tag} · <span lang="ja">{t.matched}</span>
            </Badge>
          ))}
          {row.ingredients.length === 0 && row.tags.length === 0 && <span className="text-xs text-muted-foreground">없음</span>}
        </div>
      </section>

      <section>
        <h3 className="mb-1 text-sm font-semibold">자사 대비</h3>
        {!own || !diff ? (
          <p className="text-sm text-muted-foreground">이 카테고리에는 비교할 자사 제품이 없어요</p>
        ) : (
          <>
            <p className="mb-1 text-xs text-muted-foreground">기준: {own.name}</p>
            <Fact label="ml당 가격 차이 (정가)">
              {diff.ppmDiff === null ? "—" : `${diff.ppmDiff > 0 ? "+" : ""}${diff.ppmDiff}円 (자사 ${diff.ownPpm}円)`}
            </Fact>
            <Fact label="자사에 없는 핵심 성분">{diff.missingInOwn.length > 0 ? diff.missingInOwn.map((x) => INGREDIENT_MATCH[x]?.ko ?? x).join(", ") : "없음"}</Fact>
            <Fact label="자사에만 있는 핵심 성분">{diff.onlyOwn.length > 0 ? diff.onlyOwn.map((x) => INGREDIENT_MATCH[x]?.ko ?? x).join(", ") : "없음"}</Fact>
          </>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={inCompare ? "secondary" : "default"} disabled={compareFull} onClick={() => onToggleCompare(key)}>
          {inCompare ? "비교에서 빼기" : "비교에 추가"}
        </Button>
        {row.product_id ? (
          <Link href={`/market/competitors/${row.product_id}`} target="_blank" className={buttonVariants({ variant: "outline", size: "sm" })}>
            제품 상세 열기 ↗
          </Link>
        ) : (
          <span className="self-center text-xs text-muted-foreground">상세 없음 (등록되지 않은 제품이라 상세 페이지는 없어요)</span>
        )}
        {row.url && (
          <a href={row.url} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
            상품 페이지 열기 ↗
          </a>
        )}
      </div>
      {compareFull && <p className="text-xs text-muted-foreground">비교는 {MAX_COMPARE}개까지 고를 수 있어요</p>}
    </>
  );
}

export function OverviewPanel({
  content,
  onClose,
  onOpenRow,
  own,
  selected,
  onToggleCompare,
}: {
  content: PanelContent | null;
  onClose: () => void;
  onOpenRow: (row: OverviewRow) => void;
  own: Product | null;
  selected: string[];
  onToggleCompare: (id: string) => void;
}) {
  if (!content) return null;

  if (content.kind === "product") {
    const { row } = content;
    return (
      <EvidenceSheet
        open
        onOpenChange={(open) => !open && onClose()}
        title={
          <span className="flex items-center gap-2">
            {row.brand} <span lang="ja">{row.name}</span> <LangBadge lang="ja" />
          </span>
        }
        description={row.name_ko}
      >
        <ProductSummary row={row} own={own} selected={selected} onToggleCompare={onToggleCompare} />
      </EvidenceSheet>
    );
  }

  if (content.kind === "quotes") {
    return (
      <EvidenceSheet open onOpenChange={(open) => !open && onClose()} title={content.title} description={content.description}>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          근거 원문 <LangBadge lang="ja" /> + 한국어 해석
        </p>
        <ul className="space-y-2">
          {content.quotes.map((q, i) => (
            <li key={i} className="rounded-md border p-2 text-sm">
              <p lang="ja">{q.ja}</p>
              {q.ko && <p className="mt-0.5 text-xs text-muted-foreground">{q.ko}</p>}
              {q.note && <p className="mt-1 text-xs text-muted-foreground">{q.note}</p>}
              {q.href && (
                <a href={q.href} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs underline underline-offset-4">
                  원본 열기 ↗
                </a>
              )}
            </li>
          ))}
        </ul>
        {content.rows && (
          <section>
            <h3 className="mb-1 text-sm font-semibold">{content.rows.title}</h3>
            {content.rows.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">없음</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {content.rows.items.map(({ row, note }) => (
                  <li key={`${row.brand}|${row.name}`}>
                    <button type="button" className="flex w-full items-start gap-3 px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => onOpenRow(row)}>
                      <span className="w-8 shrink-0 font-semibold">{row.rank}위</span>
                      <span className="min-w-0 flex-1">
                        <ProductLabel row={row} />
                        {note && <span className="mt-0.5 block text-xs text-muted-foreground">{note}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        {content.link && (
          <Link href={content.link.href} target="_blank" className={buttonVariants({ variant: "outline", size: "sm" })}>
            {content.link.label} ↗
          </Link>
        )}
        {content.footnote && <p className="text-xs text-muted-foreground">{content.footnote}</p>}
      </EvidenceSheet>
    );
  }

  return (
    <EvidenceSheet open onOpenChange={(open) => !open && onClose()} title={content.title} description={content.description}>
      {content.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">해당하는 제품이 없어요</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {content.rows.map(({ row, note }) => (
            <li key={`${row.brand}|${row.name}`}>
              <button type="button" className="flex w-full items-start gap-3 px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => onOpenRow(row)}>
                <span className="w-8 shrink-0 font-semibold">{row.rank}위</span>
                <span className="min-w-0 flex-1">
                  <ProductLabel row={row} />
                  {note && <span className="mt-0.5 block text-xs text-muted-foreground">{note}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">제품을 누르면 제품 요약으로 바뀌어요</p>
    </EvidenceSheet>
  );
}
