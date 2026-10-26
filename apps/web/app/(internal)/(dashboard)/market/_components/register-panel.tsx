"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { HelpTip } from "@/components/common/help-tip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatJpy } from "@/lib/format";
import { competitorCsvTemplate, parseCompetitorCsv, type CompetitorCsvResult } from "@/lib/external/competitor-csv";
import { saveCompetitorsFromCsv } from "@/lib/data/competitor-import-actions";
import { Product, type CompetitorImportRow } from "@/lib/schemas/product";
import { MARKET_CATEGORIES } from "@/app/(internal)/(dashboard)/market/_lib/market";

// 경쟁제품 등록: CSV 파일 → 미리보기 → 저장 (2026-10-26, URL·이미지 샘플 추출을 대신함).
// 팀 Qoo10 수집 CSV를 그대로 올리면 된다. 저장은 Server Action (lib/data/competitor-import-actions.ts)
const FIELD = "grid gap-1 text-xs font-medium text-muted-foreground";
const SELECT = "h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground";
const PREVIEW_ROWS = 8;

/** 샘플 모드(저장 안 됨)에서 화면에만 보일 제품 */
function toLocalProduct(r: CompetitorImportRow, category: string, index: number): Product | null {
  const parsed = Product.safeParse({
    id: `local-${index}-${r.external_id}`,
    workspace_id: "local",
    created_at: new Date().toISOString(),
    kind: "competitor",
    brand: r.brand,
    name: r.name,
    platform: "qoo10",
    url: r.url,
    price_jpy: r.price_jpy,
    volume_ml: r.volume_ml,
    ingredients: r.ingredients,
    features: r.key_ingredients_ko ? [`핵심 성분: ${r.key_ingredients_ko}`] : [],
    image_path: null,
    source_raw: { csv_import: { sale_price_jpy: r.sale_price_jpy, coupon_price_jpy: r.coupon_price_jpy } },
    price_kind: "regular",
    category,
  });
  return parsed.success ? parsed.data : null;
}

/** 양식 내려받기: 팀 Qoo10 수집 CSV와 같은 열 + 예시 한 줄 */
function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([competitorCsvTemplate()], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "qoo10_경쟁제품_양식.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function RegisterPanel({
  ownProducts,
  onAddLocal,
  onClose,
}: {
  /** 연결할 수 있는 자사 제품 */
  ownProducts: Pick<Product, "id" | "name">[];
  /** 샘플 모드에서 화면에만 더한다 */
  onAddLocal: (products: Product[]) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<CompetitorCsvResult | null>(null);
  const [category, setCategory] = useState<string>(MARKET_CATEGORIES[0]);
  const [ownProductId, setOwnProductId] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [saving, startSaving] = useTransition();

  async function readFile(file: File | undefined) {
    setMessage(null);
    if (!file) return;
    setFileName(file.name);
    setParsed(parseCompetitorCsv(await file.text()));
  }

  function save() {
    if (!parsed || parsed.rows.length === 0) return;
    const rows = parsed.rows;
    startSaving(async () => {
      const result = await saveCompetitorsFromCsv({ fileName, category, ownProductId: ownProductId || null, rows });
      if (result.ok) {
        const { inserted, updated, linked } = result.data;
        setMessage({ tone: "ok", text: `새로 ${inserted}개, 갱신 ${updated}개 저장했어요${linked ? ` · 자사 제품과 ${linked}개 연결` : ""}` });
        setParsed(null);
        router.refresh();
      } else if (result.sampleMode) {
        onAddLocal(rows.flatMap((r, i) => toLocalProduct(r, category, i) ?? []));
        setMessage({ tone: "ok", text: result.message });
        setParsed(null);
      } else {
        setMessage({ tone: "error", text: result.message });
      }
    });
  }

  const rows = parsed?.rows ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          경쟁제품 등록 · CSV
          <HelpTip>
            <span className="block">팀 Qoo10 수집 CSV를 그대로 올리면 돼요. 필요한 열: 브랜드 · 상품명 · 정상가(정가) · 상품코드(또는 상품URL)</span>
            <span className="block">있으면 같이 읽는 열: 판매가(현재할인가) · 메가와리_쿠폰할인가 · 전성분(全成分_일문) · 핵심유효성분 · 용량(ml)</span>
            <span className="block">[양식 내려받기]의 예시 줄은 지우고 그 아래 형식대로 넣어 주세요 (가격은 「2,590円」처럼, 상품코드는 숫자만).</span>
            <span className="block">같은 상품코드는 한 번만 저장되고, 다시 올리면 가격·용량·성분이 갱신돼요. 용량은 상품명에서 찾고, 다른 제품을 묶은 세트는 비워 둬요.</span>
          </HelpTip>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <div className={FIELD}>
            <span className="flex items-center justify-between gap-2">
              CSV 파일 (Qoo10)
              <button type="button" onClick={downloadTemplate} className="font-normal underline underline-offset-4 hover:text-foreground">
                양식 내려받기 ↓
              </button>
            </span>
            <Input type="file" accept=".csv,text/csv" aria-label="CSV 파일 (Qoo10)" onChange={(e) => readFile(e.target.files?.[0])} />
          </div>
          <label className={FIELD}>
            카테고리
            <select className={SELECT} value={category} onChange={(e) => setCategory(e.target.value)}>
              {MARKET_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className={FIELD}>
            자사 제품과 연결 (선택)
            <select className={SELECT} value={ownProductId} onChange={(e) => setOwnProductId(e.target.value)}>
              <option value="">연결 안 함</option>
              {ownProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {parsed?.error && (
          <Alert variant="destructive">
            <AlertDescription>{parsed.error}</AlertDescription>
          </Alert>
        )}
        {message && (
          <Alert variant={message.tone === "error" ? "destructive" : "default"}>
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        {rows.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              미리보기 · {rows.length}개 읽음
              {parsed && parsed.skipped.length > 0 && (
                <span className="ml-2 text-xs font-normal text-risk-high">
                  건너뜀 {parsed.skipped.length}줄 ({parsed.skipped.slice(0, 3).map((s) => `${s.line}줄 ${s.reason}`).join(" · ")}
                  {parsed.skipped.length > 3 ? " …" : ""})
                </span>
              )}
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>브랜드</TableHead>
                  <TableHead>상품명</TableHead>
                  <TableHead className="text-right">정가</TableHead>
                  <TableHead className="text-right">할인가</TableHead>
                  <TableHead className="text-right">용량</TableHead>
                  <TableHead className="text-right">全成分</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, PREVIEW_ROWS).map((r) => (
                  <TableRow key={r.external_id}>
                    <TableCell lang="ja">{r.brand}</TableCell>
                    <TableCell lang="ja" className="max-w-md truncate">
                      {r.name}
                    </TableCell>
                    <TableCell className="text-right">{formatJpy(r.price_jpy)}</TableCell>
                    <TableCell className="text-right">{r.sale_price_jpy ? formatJpy(r.sale_price_jpy) : "—"}</TableCell>
                    <TableCell className="text-right">{r.volume_ml ? `${r.volume_ml}ml` : <span className="text-muted-foreground">세트·모름</span>}</TableCell>
                    <TableCell className="text-right">{r.ingredients.length > 0 ? `${r.ingredients.length}개` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {rows.length > PREVIEW_ROWS && <p className="text-xs text-muted-foreground">외 {rows.length - PREVIEW_ROWS}개</p>}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={save} disabled={rows.length === 0 || saving}>
            {saving ? "저장 중…" : `${rows.length || ""}개 저장`}
          </Button>
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
