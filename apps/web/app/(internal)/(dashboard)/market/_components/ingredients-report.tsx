"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReportTemplate } from "@/components/templates";
import type { Product } from "@/lib/schemas/product";
import type { TrendSnapshot } from "@/lib/schemas/trend";
import { hasIngredient, INGREDIENT_MATCH, MARKET_CATEGORIES, ownIngredients, weekLabel } from "@/app/(internal)/(dashboard)/market/_lib/market";
import { HorizontalBarChart, TrendLineChart } from "@/app/(internal)/(dashboard)/market/_components/charts";
import { ToggleGroup } from "@/app/(internal)/(dashboard)/market/_components/toggle-group";

type Category = (typeof MARKET_CATEGORIES)[number];

export function IngredientsReport({ snapshots, products }: { snapshots: TrendSnapshot[]; products: Product[] }) {
  const [category, setCategory] = useState<Category>("化粧水");
  const series = snapshots.filter((s) => s.category === category);
  const latest = series.at(-1)?.data.ingredients ?? [];
  const [selected, setSelected] = useState<string>(latest[0]?.ingredient ?? "");
  const own = ownIngredients(products);

  const trend = series.map((s) => ({ week: weekLabel(s.captured_at), count: s.data.ingredients.find((i) => i.ingredient === selected)?.count ?? null }));
  const withIngredient = products.filter((p) => hasIngredient(p, selected)).toSorted((a, b) => (a.kind === b.kind ? 0 : a.kind === "own" ? -1 : 1));

  return (
    <ReportTemplate
      state={latest.length === 0 ? "empty" : undefined}
      filters={<ToggleGroup label="카테고리" options={MARKET_CATEGORIES} value={category} onChange={setCategory} />}
      cards={[
        {
          title: `이번 주 성분 언급 빈도 · ${category}`,
          content: (
            <>
              <HorizontalBarChart
                items={latest.map((i) => ({
                  id: i.ingredient,
                  label: own.has(i.ingredient) ? `★ ${i.ingredient}` : i.ingredient,
                  value: i.count,
                  highlight: own.has(i.ingredient),
                  selected: i.ingredient === selected,
                }))}
                onSelect={setSelected}
                labelWidth={140}
              />
              <p className="mt-2 text-xs text-muted-foreground">★ 진한 막대 = 자사 제품에 든 성분 · 단위: 언급한 랭킹 상품 수 · 막대나 아래 버튼을 눌러 선택</p>
              <div role="group" aria-label="성분 선택" className="mt-3 flex flex-wrap gap-1">
                {latest.map((i) => (
                  <Button key={i.ingredient} size="xs" variant={i.ingredient === selected ? "default" : "outline"} aria-pressed={i.ingredient === selected} onClick={() => setSelected(i.ingredient)}>
                    <span lang="ja">{i.ingredient}</span>
                  </Button>
                ))}
              </div>
            </>
          ),
        },
        {
          title: `추이 · ${selected}`,
          content: (
            <>
              <p className="mb-2 text-xs text-muted-foreground">
                {INGREDIENT_MATCH[selected]?.ko ?? ""} · 12주 · {category}
                {own.has(selected) && " · 자사 제품에 들어 있음"}
              </p>
              <TrendLineChart
                data={trend}
                series={[{ key: "count", label: selected, color: own.has(selected) ? "var(--primary)" : "var(--chart-3)", emphasis: true }]}
                height={220}
              />
            </>
          ),
        },
        {
          title: `${selected}이 든 제품`,
          wide: true,
          content:
            withIngredient.length === 0 ? (
              <p className="text-sm text-muted-foreground">등록된 자사·경쟁 제품 중 이 성분이 든 제품이 없어요</p>
            ) : (
              <ul className="grid grid-cols-2 gap-2 text-sm">
                {withIngredient.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 rounded-md border p-3">
                    <Link href={`/market/competitors/${p.id}`} className="underline-offset-4 hover:underline">
                      {p.brand} <span lang="ja">{p.name}</span>
                    </Link>
                    <span className="flex shrink-0 gap-1">
                      <Badge variant={p.kind === "own" ? "default" : "outline"}>{p.kind === "own" ? "자사" : "경쟁"}</Badge>
                      {p.category && (
                        <Badge variant="secondary">
                          <span lang="ja">{p.category}</span>
                        </Badge>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ),
        },
      ]}
    />
  );
}
