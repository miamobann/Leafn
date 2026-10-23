"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTableTemplate } from "@/components/templates";
import { formatJpy } from "@/lib/format";
import { pricePerMl, readListing, type Product } from "@/lib/schemas/product";
import { COMMON_INGREDIENTS, hasIngredient, INGREDIENT_MATCH } from "@/app/(internal)/(dashboard)/market/_lib/market";
import { HorizontalBarChart } from "@/app/(internal)/(dashboard)/market/_components/charts";
import { RegisterPanel } from "@/app/(internal)/(dashboard)/market/_components/register-panel";
import { ToggleGroup } from "@/app/(internal)/(dashboard)/market/_components/toggle-group";

const SORTS = {
  perMl: "ml당 가격 낮은 순",
  price: "税込 가격 낮은 순",
  rating: "평점 높은 순",
  reviews: "리뷰 수 많은 순",
} as const;
type SortKey = keyof typeof SORTS;
const MAX_COMPARE = 4;
// 비교 칸 수별 Tailwind 클래스 (인라인 style 대신)
const COMPARE_COLS: Record<number, string> = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" };

function sortValue(p: Product, key: SortKey): number {
  const l = readListing(p);
  if (key === "perMl") return pricePerMl(p) ?? Infinity;
  if (key === "price") return p.price_jpy ?? Infinity;
  if (key === "rating") return l?.rating != null ? -(l.rating / l.rating_scale) : Infinity;
  return -(l?.review_count ?? 0);
}

function keyIngredients(p: Product): string[] {
  return Object.keys(INGREDIENT_MATCH).filter((ing) => hasIngredient(p, ing));
}

function Rating({ p }: { p: Product }) {
  const l = readListing(p);
  if (!l || l.rating == null) return <span className="text-muted-foreground">—</span>;
  return (
    <span>
      {l.rating.toFixed(1)} <span className="text-xs text-muted-foreground">/ {l.rating_scale}</span>
      <span className="block text-xs text-muted-foreground">{l.review_count.toLocaleString("ko-KR")}건</span>
    </span>
  );
}

function Price({ p }: { p: Product }) {
  const l = readListing(p);
  return (
    <span>
      {formatJpy(p.price_jpy)}
      {l?.sale_price_jpy != null && (
        <span className="block text-xs text-muted-foreground">
          {l.sale_label ?? "행사가"} {formatJpy(l.sale_price_jpy)}
        </span>
      )}
    </span>
  );
}

export function CompetitorsView({ products }: { products: Product[] }) {
  const [added, setAdded] = useState<Product[]>([]);
  const all = [...products, ...added];
  const categories = ["전체", ...new Set(all.map((p) => p.category ?? "미분류"))];
  const [category, setCategory] = useState("전체");
  const [sort, setSort] = useState<SortKey>("perMl");
  const [selected, setSelected] = useState<string[]>([]);
  const [registering, setRegistering] = useState(false);

  // 자사 행을 맨 위에 고정하고, 그 안에서 정렬
  const rows = all
    .filter((p) => category === "전체" || (p.category ?? "미분류") === category)
    .toSorted((a, b) => (a.kind === b.kind ? sortValue(a, sort) - sortValue(b, sort) : a.kind === "own" ? -1 : 1));
  const compared = selected.map((id) => all.find((p) => p.id === id)).filter((p): p is Product => p !== undefined);
  const ownIngredientNames = new Set(all.filter((p) => p.kind === "own").flatMap((p) => p.ingredients));

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < MAX_COMPARE ? [...s, id] : s));
  }

  return (
    <div className="space-y-6">
      {registering && (
        <RegisterPanel
          nextIndex={added.length + 1}
          onClose={() => setRegistering(false)}
          onAdd={(p) => {
            setAdded((a) => [...a, p]);
            setCategory("전체");
            setRegistering(false);
          }}
        />
      )}

      <DataTableTemplate
        filters={
          <>
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
              {selected.length}개 선택 · {selected.length < 2 ? "2~4개를 고르면 아래에 나란히 비교" : `최대 ${MAX_COMPARE}개`}
            </span>
            <Button size="sm" onClick={() => setRegistering(true)} disabled={registering}>
              + 경쟁제품 등록
            </Button>
          </>
        }
        columns={[
          { key: "pick", label: "비교" },
          { key: "name", label: "제품" },
          { key: "platform", label: "판매 플랫폼" },
          { key: "price", label: "税込 가격", align: "right" },
          { key: "volume", label: "용량", align: "right" },
          { key: "perMl", label: "ml당", align: "right" },
          { key: "ingredients", label: "주요 성분" },
          { key: "features", label: "특징" },
          { key: "rating", label: "평점 · 리뷰", align: "right" },
        ]}
        rows={rows.map((p) => {
          const checked = selected.includes(p.id);
          const isLocal = p.id.startsWith("local-");
          return {
            id: p.id,
            cells: {
              pick: (
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={checked}
                  disabled={!checked && selected.length >= MAX_COMPARE}
                  onChange={() => toggle(p.id)}
                  aria-label={`${p.brand} ${p.name} 비교에 넣기`}
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
                    {isLocal && <Badge variant="outline">저장 안 됨</Badge>}
                  </span>
                  <span lang="ja" className="text-xs text-muted-foreground">
                    {p.category ?? "미분류"}
                  </span>
                </span>
              ),
              platform: p.platform,
              price: <Price p={p} />,
              volume: p.volume_ml ? `${p.volume_ml}ml` : "—",
              perMl: <span className="font-medium">{pricePerMl(p) != null ? `¥${pricePerMl(p)}` : "—"}</span>,
              ingredients: (
                <span lang="ja" className="text-xs">
                  {keyIngredients(p).slice(0, 3).join("、") || "—"}
                </span>
              ),
              features: <span className="text-xs">{p.features.join(", ")}</span>,
              rating: <Rating p={p} />,
            },
          };
        })}
      />
      <p className="text-xs text-muted-foreground">
        자사 행은 위에 고정 · ml당 가격은 정가 기준으로 화면에서 계산 · 행사가는 따로 표시 · 평점 척도는 플랫폼마다 달라요 (@cosme 7점은 확인 필요)
      </p>

      {compared.length >= 2 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>나란히 비교 · {compared.length}개</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setSelected([])}>
              선택 해제
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">ml당 가격 (税込 정가 ÷ 용량) · 진한 막대 = 자사</p>
              <HorizontalBarChart
                items={compared
                  .filter((p) => pricePerMl(p) != null)
                  .map((p) => ({ id: p.id, label: `${p.brand} ${p.name}`, value: pricePerMl(p) ?? 0, highlight: p.kind === "own" }))}
                unit="円"
                labelWidth={200}
              />
            </div>
            <div className={`grid gap-3 ${COMPARE_COLS[compared.length] ?? "grid-cols-4"}`}>
              {compared.map((p) => {
                const shared = p.kind === "own" ? null : p.ingredients.filter((x) => ownIngredientNames.has(x) && !COMMON_INGREDIENTS.has(x));
                return (
                  <div key={p.id} className={`space-y-2 rounded-lg border p-3 text-sm ${p.kind === "own" ? "border-primary" : ""}`}>
                    <Badge variant={p.kind === "own" ? "default" : "outline"}>{p.kind === "own" ? "자사" : "경쟁"}</Badge>
                    <p className="font-medium">
                      {p.brand} <span lang="ja">{p.name}</span>
                    </p>
                    <dl className="space-y-1">
                      {[
                        ["판매 플랫폼", p.platform],
                        ["税込 가격", <Price key="p" p={p} />],
                        ["용량 · ml당", `${p.volume_ml ?? "—"}ml · ${pricePerMl(p) != null ? `¥${pricePerMl(p)}` : "—"}`],
                        ["주요 성분", <span key="i" lang="ja">{keyIngredients(p).join("、") || "—"}</span>],
                        ["특징", p.features.join(", ") || "—"],
                        ["평점 · 리뷰", <Rating key="r" p={p} />],
                        ...(shared ? [["자사와 겹치는 성분", <span key="s" lang="ja">{shared.join("、") || "없음"}</span>] as const] : []),
                      ].map(([label, value]) => (
                        <div key={label as string}>
                          <dt className="text-xs text-muted-foreground">{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
