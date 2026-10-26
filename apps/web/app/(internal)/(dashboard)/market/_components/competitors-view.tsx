"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { platformLabel } from "@/lib/platforms";
import { Button } from "@/components/ui/button";
import { DataTableTemplate } from "@/components/templates";
import { formatJpy } from "@/lib/format";
import { cn } from "@/lib/utils";
import { pricePerMl, type Product } from "@/lib/schemas/product";
import { hasIngredient, INGREDIENT_MATCH } from "@/app/(internal)/(dashboard)/market/_lib/market";
import { resolveComparePair, saleOf } from "@/app/(internal)/(dashboard)/market/_lib/compare";
import { ComparePanel } from "@/app/(internal)/(dashboard)/market/_components/compare-panel";
import { RegisterPanel } from "@/app/(internal)/(dashboard)/market/_components/register-panel";
import { ToggleGroup } from "@/app/(internal)/(dashboard)/market/_components/toggle-group";

// 평점·리뷰 수는 Qoo10 랭킹·CSV에서 가져오지 못해 정렬·표에서 뺐다 (2026-10-26)
const SORTS = {
  perMl: "ml당 가격 낮은 순",
  price: "税込 가격 낮은 순",
} as const;
type SortKey = keyof typeof SORTS;
type Kind = Product["kind"];

const SELECT = "h-8 rounded-lg border border-input bg-background px-2 text-sm text-foreground";

function sortValue(p: Product, key: SortKey): number {
  if (key === "perMl") return pricePerMl(p) ?? Infinity;
  return p.price_jpy ?? Infinity;
}

function keyIngredients(p: Product): string[] {
  return Object.keys(INGREDIENT_MATCH).filter((ing) => hasIngredient(p, ing));
}

function Price({ p }: { p: Product }) {
  const sale = saleOf(p);
  return (
    <span className="whitespace-nowrap">
      {formatJpy(p.price_jpy)}
      {sale && (
        <span className="block text-xs text-muted-foreground">
          {sale.label} {formatJpy(sale.price)}
        </span>
      )}
    </span>
  );
}

/**
 * 경쟁제품 탭 (2026-10-26 정리): 자사 / 경쟁 중 하나만 표로 보고, 체크한 제품으로 [선택한 것만 남기기]·[1:1 비교하기].
 * 1:1 비교의 경쟁 제품 목록은 체크한 경쟁 제품만 보여 준다.
 * compareIds = 주소의 ?compare= 값. 바꾸면 onCompareChange로 주소를 고친다 (공유하면 같은 비교가 열린다)
 */
export function CompetitorsView({
  products,
  initialSelected = [],
  compareIds = [],
  onCompareChange,
}: {
  products: Product[];
  initialSelected?: string[];
  compareIds?: string[];
  onCompareChange?: (ids: string[] | null) => void;
}) {
  const [added, setAdded] = useState<Product[]>([]);
  const all = [...products, ...added];
  const [kind, setKind] = useState<Kind>("competitor");
  const [category, setCategory] = useState("전체");
  const [sort, setSort] = useState<SortKey>("perMl");
  // 체크한 제품 (자사·경쟁 모두. 「선택한 것만 남기기」와 1:1 비교에 쓴다)
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [registering, setRegistering] = useState(false);
  // 목록에서 뺀 제품 (화면에서만 숨김, DB는 그대로). 비교할 것만 남겨 두고 보기 위해
  const [hidden, setHidden] = useState<string[]>([]);

  const ownProducts = all.filter((p) => p.kind === "own");
  const competitorProducts = all.filter((p) => p.kind === "competitor");
  const ofKind = all.filter((p) => p.kind === kind && !hidden.includes(p.id));
  const categories = ["전체", ...new Set(ofKind.map((p) => p.category ?? "미분류"))];
  const activeCategory = categories.includes(category) ? category : "전체";
  const rows = ofKind.filter((p) => activeCategory === "전체" || (p.category ?? "미분류") === activeCategory).toSorted((a, b) => sortValue(a, sort) - sortValue(b, sort));

  const pickedOwn = ownProducts.filter((p) => selected.includes(p.id));
  const pickedCompetitors = competitorProducts.filter((p) => selected.includes(p.id));
  const pair = compareIds.length > 0 ? resolveComparePair(compareIds, all) : null;
  // 1:1 비교의 경쟁 제품 목록: 체크한 경쟁 제품만 (지금 비교 중인 제품은 체크를 풀어도 남긴다)
  const compareCompetitors = [...pickedCompetitors, ...(pair?.competitor && !pickedCompetitors.some((p) => p.id === pair.competitor?.id) ? [pair.competitor] : [])];

  function hide(ids: string[]) {
    setHidden((h) => [...new Set([...h, ...ids])]);
    setSelected((s) => s.filter((id) => !ids.includes(id)));
  }
  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
  // 체크한 자사(없으면 첫 자사 제품) × 체크한 첫 경쟁 제품
  function openCompare() {
    const own = pickedOwn[0] ?? ownProducts[0];
    const competitor = pickedCompetitors[0];
    if (own && competitor) onCompareChange?.([own.id, competitor.id]);
  }

  return (
    <div className="space-y-4">
      {pair && (
        <ComparePanel
          pair={pair}
          ownProducts={ownProducts}
          competitorProducts={compareCompetitors}
          onChange={(ownId, competitorId) => onCompareChange?.([ownId, competitorId].filter((x): x is string => Boolean(x)))}
          onClose={() => onCompareChange?.(null)}
        />
      )}

      {registering && (
        <RegisterPanel
          ownProducts={ownProducts}
          onClose={() => setRegistering(false)}
          onAddLocal={(list) => {
            setAdded((a) => [...a, ...list]);
            setKind("competitor");
            setCategory("전체");
          }}
        />
      )}

      <DataTableTemplate
        filters={
          <div className="w-full space-y-3">
            {/* 1줄: 보기 조건 */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <div role="tablist" aria-label="자사 / 경쟁" className="inline-flex rounded-lg bg-muted p-1">
                {(
                  [
                    { key: "own", label: "자사", count: ownProducts.filter((p) => !hidden.includes(p.id)).length },
                    { key: "competitor", label: "경쟁", count: competitorProducts.filter((p) => !hidden.includes(p.id)).length },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={kind === t.key}
                    onClick={() => setKind(t.key)}
                    className={cn("min-h-8 rounded-md px-4 text-sm", kind === t.key ? "bg-background font-semibold shadow-sm" : "text-muted-foreground")}
                  >
                    {t.label} <span className="ml-0.5 text-xs tabular-nums text-muted-foreground">{t.count}</span>
                  </button>
                ))}
              </div>
              <ToggleGroup label="카테고리" options={categories} value={activeCategory} onChange={setCategory} />
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                정렬
                <select className={SELECT} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                  {Object.entries(SORTS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {/* 2줄: 할 일 */}
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" disabled={selected.length === 0} onClick={() => hide(all.filter((p) => !selected.includes(p.id)).map((p) => p.id))}>
                선택한 것만 남기기{selected.length > 0 && ` (${selected.length})`}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pickedCompetitors.length === 0 || ownProducts.length === 0}
                onClick={openCompare}
                title={pickedCompetitors.length === 0 ? "경쟁 제품을 하나 이상 체크해 주세요 (자사는 체크한 것, 없으면 첫 자사 제품)" : undefined}
              >
                1:1 비교하기
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRegistering(true)} disabled={registering}>
                + 경쟁제품 등록
              </Button>
              {hidden.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setHidden([])}>
                  모든 데이터 다시 보기
                </Button>
              )}
            </div>
          </div>
        }
        columns={[
          { key: "pick", label: "" },
          { key: "name", label: kind === "own" ? "자사 제품" : "경쟁 제품" },
          { key: "price", label: "税込 가격", align: "right" },
          { key: "volume", label: "용량", align: "right" },
          { key: "perMl", label: "ml당", align: "right" },
          { key: "ingredients", label: "주요 성분" },
          { key: "features", label: "특징" },
          { key: "remove", label: "" },
        ]}
        rows={rows.map((p) => {
          // 상세 페이지가 없는 제품: 샘플 모드에서 올린 것(local-), 플랫폼 분석 랭킹에서 가져온 것(rank:)
          const fromRanking = p.id.startsWith("rank:");
          const isLocal = p.id.startsWith("local-") || fromRanking;
          const title = (
            <>
              {p.brand} <span lang="ja">{p.title_ai?.name_short_ja ?? p.name}</span>
            </>
          );
          return {
            id: p.id,
            cells: {
              pick: (
                <input type="checkbox" className="size-4 accent-primary" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} aria-label={`${p.brand} ${p.name} 선택`} />
              ),
              name: (
                <span className="flex max-w-[22rem] min-w-[14rem] flex-col gap-0.5 whitespace-normal">
                  <span className="line-clamp-2 break-keep" title={`${p.brand} ${p.name}`}>
                    {isLocal ? title : (
                      <Link href={`/market/competitors/${p.id}`} className="underline-offset-4 hover:underline">
                        {title}
                      </Link>
                    )}
                  </span>
                  <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    <span lang="ja">{p.category ?? "미분류"}</span> · {platformLabel(p.platform)}
                    {fromRanking ? <Badge variant="outline">랭킹에서</Badge> : isLocal && <Badge variant="outline">저장 안 됨</Badge>}
                  </span>
                </span>
              ),
              price: <Price p={p} />,
              volume: <span className="whitespace-nowrap">{p.volume_ml ? `${p.volume_ml}ml` : "—"}</span>,
              perMl: <span className="font-medium whitespace-nowrap">{pricePerMl(p) != null ? `¥${pricePerMl(p)}` : "—"}</span>,
              ingredients: (
                <span lang="ja" className="block max-w-[10rem] text-xs whitespace-normal">
                  {keyIngredients(p).slice(0, 3).join("、") || "—"}
                </span>
              ),
              features: (
                <span className="line-clamp-2 block max-w-[16rem] text-xs whitespace-normal break-keep" title={p.features.join(", ")}>
                  {p.features.join(", ") || "—"}
                </span>
              ),
              remove: (
                <Button size="sm" variant="ghost" onClick={() => hide([p.id])} aria-label={`${p.brand} ${p.name} 목록에서 빼기`}>
                  빼기
                </Button>
              ),
            },
          };
        })}
      />
      <p className="text-xs text-muted-foreground">
        ml당 가격은 평시가 기준으로 화면에서 계산 · 행사가는 따로 표시 · [빼기]와 [선택한 것만 남기기]는 이 화면에서만 숨겨요 (저장된 제품은 그대로)
      </p>
    </div>
  );
}
