"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { platformLabel } from "@/lib/platforms";
import { Button } from "@/components/ui/button";
import { DataTableTemplate } from "@/components/templates";
import { formatJpy } from "@/lib/format";
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
    <span>
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
 * 경쟁제품 탭: 제품 목록 + 자사 1개 · 경쟁 1개 1:1 비교 (2026-10-26, 예전 4개 나란히 비교를 대신함).
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
  const categories = ["전체", ...new Set(all.map((p) => p.category ?? "미분류"))];
  const [category, setCategory] = useState("전체");
  const [sort, setSort] = useState<SortKey>("perMl");
  // 체크한 제품 (「선택한 것만 남기기」용)
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [registering, setRegistering] = useState(false);
  // 목록에서 뺀 제품 (화면에서만 숨김, DB는 그대로). 비교할 것만 남겨 두고 보기 위해
  const [hidden, setHidden] = useState<string[]>([]);

  // 자사 행을 맨 위에 고정하고, 그 안에서 정렬
  const rows = all
    .filter((p) => !hidden.includes(p.id))
    .filter((p) => category === "전체" || (p.category ?? "미분류") === category)
    .toSorted((a, b) => (a.kind === b.kind ? sortValue(a, sort) - sortValue(b, sort) : a.kind === "own" ? -1 : 1));
  const ownProducts = all.filter((p) => p.kind === "own");
  const competitorProducts = all.filter((p) => p.kind === "competitor");
  // [이 제품과 비교]에 쓰는 자사 제품. 비교 중이면 그 자사 제품, 아니면 고른 값(기본 첫 자사 제품)
  const [ownPick, setOwnPick] = useState<string>(ownProducts[0]?.id ?? "");
  const pair = compareIds.length > 0 ? resolveComparePair(compareIds, all) : null;
  const compareWith = (ownId: string | null, competitorId: string | null) => onCompareChange?.([ownId, competitorId].filter((x): x is string => Boolean(x)));

  function hide(ids: string[]) {
    setHidden((h) => [...new Set([...h, ...ids])]);
    setSelected((s) => s.filter((id) => !ids.includes(id)));
  }

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  return (
    <div className="space-y-6">
      {registering && (
        <RegisterPanel
          ownProducts={products.filter((p) => p.kind === "own")}
          onClose={() => setRegistering(false)}
          onAddLocal={(list) => {
            setAdded((a) => [...a, ...list]);
            setCategory("전체");
          }}
        />
      )}

      {pair && (
        <ComparePanel
          pair={pair}
          ownProducts={ownProducts}
          competitorProducts={competitorProducts}
          onChange={(ownId, competitorId) => {
            if (ownId) setOwnPick(ownId);
            compareWith(ownId, competitorId);
          }}
          onClose={() => onCompareChange?.(null)}
        />
      )}

      <DataTableTemplate
        filters={
          <>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              자사 제품
              <select className="h-7 rounded-lg border border-input bg-background px-2 text-sm text-foreground" value={pair?.own?.id ?? ownPick} onChange={(e) => setOwnPick(e.target.value)}>
                {ownProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <ToggleGroup label="카테고리" options={categories} value={category} onChange={setCategory} />
            <label className="ml-2 flex items-center gap-1 text-xs text-muted-foreground">
              정렬
              <select className="h-7 rounded-lg border border-input bg-background px-2 text-sm text-foreground" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                {Object.entries(SORTS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <span className="ml-auto text-xs text-muted-foreground">
              {selected.length}개 선택 · 경쟁 제품의 [이 제품과 비교]로 1:1 비교
            </span>
            <Button size="sm" variant="outline" disabled={selected.length === 0} onClick={() => hide(rows.filter((p) => !selected.includes(p.id)).map((p) => p.id))}>
              선택한 것만 남기기
            </Button>
            {hidden.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setHidden([])}>
                뺀 {hidden.length}개 다시 보기
              </Button>
            )}
            <Button size="sm" onClick={() => setRegistering(true)} disabled={registering}>
              + 경쟁제품 등록
            </Button>
          </>
        }
        columns={[
          { key: "pick", label: "선택" },
          { key: "name", label: "제품" },
          { key: "platform", label: "판매 플랫폼" },
          { key: "price", label: "税込 가격", align: "right" },
          { key: "volume", label: "용량", align: "right" },
          { key: "perMl", label: "ml당", align: "right" },
          { key: "ingredients", label: "주요 성분" },
          { key: "features", label: "특징" },
          { key: "compare", label: "" },
          { key: "remove", label: "" },
        ]}
        rows={rows.map((p) => {
          const checked = selected.includes(p.id);
          // 상세 페이지가 없는 제품: 샘플 모드에서 올린 것(local-), 플랫폼 분석 랭킹에서 가져온 것(rank:)
          const fromRanking = p.id.startsWith("rank:");
          const isLocal = p.id.startsWith("local-") || fromRanking;
          return {
            id: p.id,
            cells: {
              pick: (
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={checked}
                  onChange={() => toggle(p.id)}
                  aria-label={`${p.brand} ${p.name} 선택`}
                />
              ),
              name: (
                <span className="inline-flex flex-col gap-1">
                  <span className="inline-flex flex-wrap items-center gap-1">
                    {p.kind === "own" && <Badge>자사</Badge>}
                    {isLocal ? (
                      <span>
                        {p.brand} <span lang="ja">{p.name}</span>
                      </span>
                    ) : (
                      <Link href={`/market/competitors/${p.id}`} className="underline-offset-4 hover:underline">
                        {p.brand} <span lang="ja">{p.name}</span>
                      </Link>
                    )}
                    {fromRanking ? <Badge variant="outline">랭킹에서</Badge> : isLocal && <Badge variant="outline">저장 안 됨</Badge>}
                  </span>
                  <span lang="ja" className="text-xs text-muted-foreground">
                    {p.category ?? "미분류"}
                  </span>
                </span>
              ),
              platform: platformLabel(p.platform),
              price: <Price p={p} />,
              volume: p.volume_ml ? `${p.volume_ml}ml` : "—",
              perMl: <span className="font-medium">{pricePerMl(p) != null ? `¥${pricePerMl(p)}` : "—"}</span>,
              ingredients: (
                <span lang="ja" className="text-xs">
                  {keyIngredients(p).slice(0, 3).join("、") || "—"}
                </span>
              ),
              features: <span className="text-xs">{p.features.join(", ")}</span>,
              compare:
                p.kind === "competitor" ? (
                  <Button
                    size="sm"
                    variant={pair?.competitor?.id === p.id ? "secondary" : "outline"}
                    disabled={ownProducts.length === 0}
                    onClick={() => compareWith(pair?.own?.id ?? ownPick, p.id)}
                  >
                    이 제품과 비교
                  </Button>
                ) : null,
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
        자사 행은 위에 고정 · ml당 가격은 평시가 기준으로 화면에서 계산 · 행사가는 따로 표시 · [빼기]는 이 화면에서만 숨겨요 (저장된 제품은 그대로)
      </p>
    </div>
  );
}
