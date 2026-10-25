"use client";

// 경쟁 제품 리뷰 CSV를 브라우저에서만 읽어 열 연결 · 검증 · 미리보기를 보여준다 (prototype-plan P4). 저장하지 않는다.
// 플랫폼과 제품은 CSV가 아니라 화면에서 고른다. 언어는 일본어, 평점은 1~5점으로 고정한다.
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { EmptyState, ErrorState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { autoMapping, type CheckedRow, checkRows, FIELDS, type FieldKey, type Mapping, missingFields, type Parsed, readCsv } from "./csv-columns";
import { IMPORT_PLATFORMS as PLATFORMS } from "./import-platforms";

const TEXT = {
  targetTitle: "가져올 곳",
  targetHint: "먼저 어느 플랫폼의 어느 경쟁 제품 리뷰인지 골라 주세요. 언어는 일본어, 평점은 1~5점으로 가져와요.",
  platformLabel: "플랫폼",
  platformPlaceholder: "플랫폼을 골라 주세요",
  productLabel: "제품",
  productPlaceholder: "제품을 골라 주세요",
  productNeedPlatform: "플랫폼을 먼저 골라 주세요",
  newProduct: "+ 새 경쟁 제품 등록",
  newBrand: "브랜드",
  newName: "제품명",
  newProductNote: "저장 단계에서 경쟁 제품으로 함께 등록돼요 (지금은 저장되지 않아요)",
  needTarget: "플랫폼과 제품을 고르면 미리보기가 보여요",
  uploadTitle: "CSV 업로드",
  uploadHint: "UTF-8 CSV · 첫 줄은 열 이름 · 일본어 리뷰 · 파일은 브라우저에서만 읽고 저장하지 않아요",
  mappingTitle: "열 연결",
  mappingHint: "CSV의 어느 열이 어떤 값인지 골라 주세요. 열 이름이 같거나 비슷하면 자동으로 연결돼요.",
  notMapped: "연결 안 함",
  required: "필수",
  missingRequired: "필수 열을 모두 연결하면 미리보기가 보여요",
  empty: "파일을 올리면 미리보기가 보여요",
  emptyAction: "샘플: lib/mock/samples/reviews-ja-sample.csv",
  previewTitle: "미리보기",
  onlyErrors: "오류만 보기",
  showAll: "전체 보기",
  ok: "✓ 정상",
  error: "✕ 오류",
  ratingTitle: "평점 분포",
  skinTitle: "피부타입 분포",
  monthTitle: "월별 리뷰 수",
  chartNote: "정상 행만 집계",
  progressTitle: "분석 진행률",
  progressNote: "AI 분석은 아직 연결 전이에요 (P4) · 저장되지 않음",
} as const;

const BATCH_SIZE = 50; // CLAUDE.md 0장: 리뷰 분석은 50건 묶음
const PREVIEW_LIMIT = 50;
const NEW_PRODUCT = "__new__";

type ProductOption = { id: string; name: string; brand: string; kind: "own" | "competitor"; platform: string };

// 단일 계열 막대: dataviz 기본 팔레트 1번
const chartConfig = { count: { label: "리뷰 수", color: "#2a78d6" } } satisfies ChartConfig;

function countBy(values: string[], order?: string[]) {
  const counts = new Map<string, number>();
  for (const v of order ?? []) counts.set(v, 0);
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const entries = [...counts].map(([label, count]) => ({ label, count }));
  return order ? entries : entries.sort((a, b) => b.count - a.count);
}

export function CsvImport({ products }: { products: ProductOption[] }) {
  const [platformId, setPlatformId] = useState("");
  const [productChoice, setProductChoice] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [newName, setNewName] = useState("");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlyErrors, setOnlyErrors] = useState(false);

  const platform = PLATFORMS.find((p) => p.id === platformId);
  const competitors = platform ? products.filter((p) => p.kind === "competitor" && p.platform === platform.id) : [];
  const isNewProduct = productChoice === NEW_PRODUCT;
  const picked = competitors.find((p) => p.id === productChoice);
  const targetName = isNewProduct ? `${newBrand.trim()} ${newName.trim()}`.trim() : picked ? `${picked.brand} ${picked.name}` : "";
  const targetReady = Boolean(platform) && (isNewProduct ? Boolean(newBrand.trim() && newName.trim()) : Boolean(picked));

  function handlePlatform(id: string) {
    setPlatformId(id);
    setProductChoice("");
    setNewBrand("");
    setNewName("");
  }

  function handleFile(file: File | undefined) {
    setError(null);
    setParsed(null);
    setMapping(null);
    setOnlyErrors(false);
    if (!file) return;
    readCsv(file, (res) => {
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setParsed(res.parsed);
      setMapping(autoMapping(res.parsed.headers));
    });
  }

  const missingRequired = mapping ? missingFields(mapping) : [];

  const checked = useMemo<CheckedRow[]>(() => (parsed && mapping ? checkRows(parsed, mapping) : []), [parsed, mapping]);

  const valid = checked.flatMap((r) => (r.ok ? [r.data] : []));
  const errorCount = checked.length - valid.length;
  const batches = Math.ceil(valid.length / BATCH_SIZE);
  const visible = (onlyErrors ? checked.filter((r) => !r.ok) : checked).slice(0, PREVIEW_LIMIT);

  const charts = [
    { title: TEXT.ratingTitle, data: countBy(valid.map((r) => `${r.rating}점`), ["1점", "2점", "3점", "4점", "5점"]) },
    { title: TEXT.skinTitle, data: countBy(valid.map((r) => r.skin_type ?? "미기재")) },
    { title: TEXT.monthTitle, data: countBy(valid.map((r) => r.posted_date.slice(0, 7)).sort()) },
  ];

  const selectClass = "h-8 w-full rounded-md border bg-background px-2 text-sm disabled:opacity-50";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{TEXT.targetTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{TEXT.targetHint}</p>
          <div className="grid grid-cols-[6rem_1fr] items-center gap-2 text-sm">
            <label htmlFor="import-platform">{TEXT.platformLabel}</label>
            <select id="import-platform" className={selectClass} value={platformId} onChange={(e) => handlePlatform(e.target.value)}>
              <option value="">{TEXT.platformPlaceholder}</option>
              {PLATFORMS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <label htmlFor="import-product">{TEXT.productLabel}</label>
            <select
              id="import-product"
              className={selectClass}
              value={productChoice}
              disabled={!platform}
              onChange={(e) => setProductChoice(e.target.value)}
            >
              <option value="">{platform ? TEXT.productPlaceholder : TEXT.productNeedPlatform}</option>
              {competitors.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.brand} {p.name}
                </option>
              ))}
              {platform && <option value={NEW_PRODUCT}>{TEXT.newProduct}</option>}
            </select>
            {isNewProduct && (
              <>
                <span>{TEXT.newBrand}</span>
                <Input value={newBrand} onChange={(e) => setNewBrand(e.target.value)} className="h-8" />
                <span>{TEXT.newName}</span>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="h-8" lang="ja" />
              </>
            )}
          </div>
          {isNewProduct && <p className="text-xs text-muted-foreground">{TEXT.newProductNote}</p>}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{TEXT.uploadTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input type="file" accept=".csv,text/csv" onChange={(e) => handleFile(e.target.files?.[0])} />
            <p className="text-xs text-muted-foreground">{TEXT.uploadHint}</p>
            {parsed && (
              <p className="text-sm">
                <span className="font-medium">{parsed.fileName}</span> · {parsed.rows.length}행 · 열 {parsed.headers.length}개
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{TEXT.mappingTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">{TEXT.mappingHint}</p>
            {parsed && mapping ? (
              <div className="grid grid-cols-[6rem_1fr] items-center gap-2 text-sm">
                {FIELDS.map((f) => (
                  <label key={f.key} className="contents">
                    <span>
                      {f.label}
                      {f.required && <span className="ml-1 text-xs text-muted-foreground">({TEXT.required})</span>}
                    </span>
                    <select
                      className="h-8 rounded-md border bg-background px-2"
                      value={mapping[f.key]}
                      onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}
                    >
                      <option value="">{TEXT.notMapped}</option>
                      {parsed.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>
      </div>

      {error && <ErrorState message={error} />}

      {!parsed && !error && <EmptyState message={TEXT.empty} action={TEXT.emptyAction} />}

      {parsed && !targetReady && <EmptyState message={TEXT.needTarget} action={`${TEXT.platformLabel}, ${TEXT.productLabel}`} />}

      {parsed && targetReady && missingRequired.length > 0 && (
        <EmptyState message={TEXT.missingRequired} action={missingRequired.map((f) => f.label).join(", ")} />
      )}

      {targetReady && checked.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary">{platform?.label}</Badge>
            <span className="font-medium" lang="ja">
              {targetName}
            </span>
            {isNewProduct && <Badge variant="outline">새로 등록</Badge>}
            <Badge variant="outline">일본어</Badge>
            <Badge variant="outline">평점 1~5</Badge>
          </div>

          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "전체 행", value: `${checked.length}건` },
              { label: "정상", value: `${valid.length}건` },
              { label: "오류", value: `${errorCount}건` },
              { label: "분석 묶음", value: `${batches}묶음 (${BATCH_SIZE}건씩)` },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="mt-1 text-2xl font-semibold">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4">
            {charts.map((c) => (
              <Card key={c.title}>
                <CardHeader>
                  <CardTitle>{c.title}</CardTitle>
                  <p className="text-xs text-muted-foreground">{TEXT.chartNote}</p>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="aspect-auto h-52 w-full">
                    <BarChart data={c.data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} fontSize={11} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={24} />
                      <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator />} />
                      <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                {TEXT.previewTitle}
                <span className="ml-2 text-xs font-normal text-muted-foreground">최대 {PREVIEW_LIMIT}행</span>
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => setOnlyErrors(!onlyErrors)} disabled={errorCount === 0}>
                {onlyErrors ? TEXT.showAll : `${TEXT.onlyErrors} (${errorCount})`}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="max-h-[28rem] overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-right">줄</TableHead>
                      <TableHead className="w-20">상태</TableHead>
                      {FIELDS.map((f) => (
                        <TableHead key={f.key}>{f.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((r) => {
                      const cells: Record<FieldKey, string> = r.ok
                        ? { ...r.data, rating: String(r.data.rating), skin_type: r.data.skin_type ?? "", age_group: r.data.age_group ?? "" }
                        : r.raw;
                      return (
                        <TableRow key={r.line}>
                          <TableCell className="text-right text-muted-foreground">{r.line}</TableCell>
                          <TableCell>
                            {r.ok ? (
                              <Badge className="bg-status-approved/15 text-status-approved">{TEXT.ok}</Badge>
                            ) : (
                              <Badge className="bg-status-rejected/15 text-status-rejected" title={r.issues.join(" · ")}>
                                {TEXT.error}
                              </Badge>
                            )}
                          </TableCell>
                          {FIELDS.map((f) => (
                            <TableCell
                              key={f.key}
                              lang={f.key === "body" || f.key === "skin_type" || f.key === "age_group" ? "ja" : undefined}
                              className={f.key === "body" ? "max-w-80 whitespace-normal" : undefined}
                            >
                              {cells[f.key]}
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {visible.some((r) => !r.ok) && (
                <ul className="mt-3 space-y-1 text-xs text-status-rejected">
                  {visible.flatMap((r) => (r.ok ? [] : [<li key={r.line}>{`${r.line}번 줄: ${r.issues.join(" · ")}`}</li>]))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{TEXT.progressTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Progress value={0} aria-label={TEXT.progressTitle} />
              <p className="text-xs text-muted-foreground">
                정상 {valid.length}건 → {batches}묶음 대기 · {TEXT.progressNote}
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
