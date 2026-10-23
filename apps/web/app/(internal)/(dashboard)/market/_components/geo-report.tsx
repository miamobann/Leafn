"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReportTemplate } from "@/components/templates";
import type { GeoSnapshot } from "@/lib/schemas/geo";
import { OWN_BRAND } from "@/app/(internal)/(dashboard)/market/_lib/market";
import { HorizontalBarChart } from "@/app/(internal)/(dashboard)/market/_components/charts";

type Mention = "own" | "competitor" | "none";

function mention(g: GeoSnapshot): Mention {
  if (g.brands_mentioned.includes(OWN_BRAND)) return "own";
  return g.brands_mentioned.length > 0 ? "competitor" : "none";
}

// 색만으로 구분하지 않고 기호·글자를 같이 쓴다
const MENTION_LABEL: Record<Mention, string> = { own: "● 자사 언급", competitor: "○ 경쟁만", none: "– 언급 없음" };

/** 답변 원문에서 브랜드 이름을 표시한다 (긴 이름부터 찾는다) */
function Highlighted({ text, brands }: { text: string; brands: string[] }) {
  if (brands.length === 0) return <>{text}</>;
  const sorted = brands.toSorted((a, b) => b.length - a.length);
  const pattern = new RegExp(`(${sorted.map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  return (
    <>
      {text.split(pattern).map((part, i) =>
        brands.includes(part) ? (
          <mark key={i} className={part === OWN_BRAND ? "rounded bg-primary px-0.5 text-primary-foreground" : "rounded bg-muted px-0.5 font-medium text-foreground"}>
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export function GeoReport({ snapshots }: { snapshots: GeoSnapshot[] }) {
  const queries = [...new Set(snapshots.map((g) => g.query))];
  const engines = [...new Set(snapshots.map((g) => g.engine))];
  const [selectedId, setSelectedId] = useState(snapshots[0]?.id ?? "");
  const selected = snapshots.find((g) => g.id === selectedId) ?? null;

  const total = snapshots.length;
  const ownCount = snapshots.filter((g) => mention(g) === "own").length;
  const counts = new Map<string, number>();
  for (const g of snapshots) for (const b of g.brands_mentioned) counts.set(b, (counts.get(b) ?? 0) + 1);
  const shares = [...counts.entries()].toSorted((a, b) => b[1] - a[1]);

  return (
    <ReportTemplate
      state={total === 0 ? "empty" : undefined}
      cards={[
        {
          title: `${OWN_BRAND} 언급률`,
          content: (
            <div className="space-y-3 text-sm">
              <p>
                <span className="text-3xl font-semibold">{total === 0 ? 0 : Math.round((ownCount / total) * 100)}%</span>
                <span className="ml-2 text-muted-foreground">
                  답변 {total}건 중 {ownCount}건
                </span>
              </p>
              <ul className="space-y-1">
                {engines.map((e) => {
                  const rows = snapshots.filter((g) => g.engine === e);
                  return (
                    <li key={e} className="flex justify-between">
                      <span>{e}</span>
                      <span className="text-muted-foreground">
                        질의 {rows.length}개 중 <span className="font-medium text-foreground">{rows.filter((g) => mention(g) === "own").length}</span>개
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-muted-foreground">질의 {queries.length}개 × 엔진 {engines.length}개 · 측정 {selected?.captured_at.slice(0, 10) ?? "—"} (샘플)</p>
            </div>
          ),
        },
        {
          title: "브랜드별 언급 점유",
          content: (
            <>
              <HorizontalBarChart
                items={shares.map(([b, n]) => ({ id: b, label: b === OWN_BRAND ? `★ ${b}` : b, value: n, highlight: b === OWN_BRAND }))}
                unit="건"
                labelWidth={100}
              />
              <p className="mt-2 text-xs text-muted-foreground">답변 {total}건 중 해당 브랜드가 나온 답변 수 · ★ 진한 막대 = 자사</p>
            </>
          ),
        },
        {
          title: "질의별 노출",
          wide: true,
          content: (
            <>
              <p className="mb-2 text-xs text-muted-foreground">칸을 누르면 아래에 답변 원문이 열려요</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>질의 (일본어)</TableHead>
                    {engines.map((e) => (
                      <TableHead key={e} className="text-center">
                        {e}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queries.map((q) => (
                    <TableRow key={q}>
                      <TableCell lang="ja">{q}</TableCell>
                      {engines.map((e) => {
                        const g = snapshots.find((x) => x.query === q && x.engine === e);
                        if (!g) return <TableCell key={e} className="text-center text-muted-foreground">미측정</TableCell>;
                        const m = mention(g);
                        return (
                          <TableCell key={e} className="text-center">
                            <Button
                              size="sm"
                              variant={m === "own" ? "default" : m === "competitor" ? "secondary" : "outline"}
                              aria-pressed={g.id === selectedId}
                              className={g.id === selectedId ? "ring-2 ring-ring" : undefined}
                              onClick={() => setSelectedId(g.id)}
                            >
                              {MENTION_LABEL[m]}
                            </Button>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          ),
        },
        {
          title: "답변 원문",
          wide: true,
          content: selected ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline">{selected.engine}</Badge>
                <span lang="ja" className="font-medium">
                  {selected.query}
                </span>
                <span className="text-xs text-muted-foreground">측정 {selected.captured_at.slice(0, 16).replace("T", " ")} JST</span>
              </div>
              <p lang="ja" className="rounded-md border p-4 leading-relaxed">
                <Highlighted text={selected.answer} brands={selected.brands_mentioned} />
              </p>
              <p className="text-xs text-muted-foreground">
                언급 브랜드: {selected.brands_mentioned.length > 0 ? selected.brands_mentioned.join(", ") : "없음"} · 샘플 답변이며 실제 AI 엔진 응답이 아니에요. GEO 해석은 팀 확인이 필요해요 (CLAUDE.md 11장)
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">위 표에서 칸을 골라 주세요</p>
          ),
        },
      ]}
    />
  );
}
