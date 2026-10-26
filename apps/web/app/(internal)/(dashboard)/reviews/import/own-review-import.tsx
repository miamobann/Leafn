"use client";

// 우리 제품 리뷰 가져오기: ① 제품 · 출처를 확인하고 CSV를 올리고 → ② 열을 맞춰 저장하고 → ③ 결과를 본다.
// 파일은 브라우저에서 읽고(csv-columns.ts), 저장은 saveReviewsFromCsv가 묶음마다 한다. 이미 저장된 리뷰는 건너뛴다.
// 제품 칸 규칙 (해원 최종안): 주소의 product가 판매중인 우리 제품이면 고정해서 보여주고, 아니면 판매중 제품만 담은 드롭다운.
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type ImportOwnProduct, saveReviewsFromCsv } from "@/lib/data/review-import-actions";
import type { ReviewImportOrigin } from "@/lib/schemas/review";
import { cn } from "@/lib/utils";
import { autoMapping, checkRows, FIELDS, type Mapping, missingFields, type Parsed, readCsv } from "./csv-columns";
import {
  ActionBar,
  BigStepper,
  bigButtonClass,
  bigSelectClass,
  importHref,
  MakingReport,
  moveLinkClass,
  NextSteps,
  Question,
  SavedPanel,
  SelectField,
  SummaryBar,
} from "./import-parts";
import { useReportMaking } from "./use-report-making";

const STEPS = [
  ["파일 올리기", "어느 제품의 어디 리뷰인지 확인하고 CSV를 올려요"],
  ["확인하고 저장", "열이 맞는지 보고 리뷰를 저장해요"],
  ["저장 끝 · 리포트 보기", "저장한 리뷰로 이 제품의 리포트를 확인해요"],
] as const;

const ORIGINS: { id: ReviewImportOrigin; label: string }[] = [
  { id: "oliveyoung", label: "올리브영" },
  { id: "own_mall", label: "자사몰" },
  { id: "other", label: "기타" },
];

const PREVIEW_ROWS = 5;
const SAVE_CHUNK = 200; // 한 번에 보내는 줄 수. 서버 함수 요청 크기(1MB)를 넘지 않게 나눈다 (서버는 500줄까지 받는다)
const SAMPLE = ["리뷰번호,별점,리뷰내용,작성일,피부타입,연령대", "10234,5,끈적이지 않고 산뜻해요,2026-09-30,건성,20대"];

type Result = { inserted: number; skipped: number; errors: number };

export function OwnReviewImport({
  products,
  initialProductId,
  wrongProduct,
}: {
  /** 판매중인 우리 제품 */
  products: ImportOwnProduct[];
  /** 주소의 product가 판매중인 우리 제품일 때 그 id */
  initialProductId: string | null;
  /** 주소에 product가 있는데 판매중인 우리 제품이 아닐 때 */
  wrongProduct: boolean;
}) {
  const [productId, setProductId] = useState(initialProductId ?? (products.length === 1 ? products[0].id : ""));
  const [picking, setPicking] = useState(!initialProductId);
  const [origin, setOrigin] = useState<ReviewImportOrigin>("oliveyoung");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showSample, setShowSample] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const making = useReportMaking();

  const product = products.find((p) => p.id === productId);
  const originLabel = ORIGINS.find((o) => o.id === origin)?.label ?? "";
  const checked = useMemo(() => (parsed && mapping ? checkRows(parsed, mapping) : []), [parsed, mapping]);
  const valid = checked.flatMap((r) => (r.ok ? [r] : []));
  const errorCount = checked.length - valid.length;
  const missing = mapping ? missingFields(mapping) : [];
  const stage = result ? 3 : parsed ? 2 : 1;

  function handleFile(file: File | undefined) {
    setMessage(null);
    if (!file) return;
    readCsv(file, (res) => {
      if (!res.ok) {
        setMessage(res.message);
        return;
      }
      setParsed(res.parsed);
      setMapping(autoMapping(res.parsed.headers));
    });
  }

  function resetFile() {
    setParsed(null);
    setMapping(null);
    setMessage(null);
    setResult(null);
  }

  async function save() {
    if (!product || !parsed || valid.length === 0) return;
    setMessage(null);
    const rows = valid.map((r) => ({ ...r.data, review_no: r.reviewNo || undefined, raw: r.source }));
    const total: Result = { inserted: 0, skipped: 0, errors: errorCount };
    setProgress({ done: 0, total: rows.length });
    try {
      for (let i = 0; i < rows.length; i += SAVE_CHUNK) {
        const res = await saveReviewsFromCsv({
          productId: product.id,
          lang: "ko",
          source: origin === "oliveyoung" ? "oliveyoung" : "csv",
          origin,
          fileName: parsed.fileName,
          rows: rows.slice(i, i + SAVE_CHUNK),
        });
        if (!res.ok) {
          setMessage(i === 0 ? res.message : `${res.message} (앞의 ${i.toLocaleString("en-US")}건은 저장됐어요. 다시 저장하면 저장된 리뷰는 건너뛰어요.)`);
          return;
        }
        total.inserted += res.data.inserted;
        total.skipped += res.data.skipped;
        setProgress({ done: Math.min(i + SAVE_CHUNK, rows.length), total: rows.length });
      }
      setResult(total);
      if (total.inserted > 0) void making.start(product.id); // 저장은 끝났다. 새 리뷰가 있으면 제품명 정리·분석·번역을 이어서 한다
    } catch {
      setMessage("서버에 연결하지 못했어요. 다시 저장하면 이미 저장된 리뷰는 건너뛰어요.");
    } finally {
      setProgress(null);
    }
  }

  const productName = product ? `${product.brand} ${product.name}` : "";
  const productSpec = product ? [product.category, product.volumeMl ? `${product.volumeMl}ml` : null, "판매중"].filter(Boolean).join(" · ") : "";
  const errorBox = message && <p className="rounded-lg border border-status-rejected/40 bg-status-rejected/5 p-3 text-sm">{message}</p>;

  if (stage === 3 && result && parsed) {
    const dup = result.inserted === 0;
    return (
      <div className="space-y-6">
        <BigStepper steps={STEPS} current={3} />
        <SavedPanel title={dup ? "이미 저장된 리뷰예요" : `${productName} 리뷰를 저장했어요`} sub={`${originLabel} · ${parsed.fileName}`}>
          <div className="flex gap-10 border-y border-status-approved/40 py-4">
            {[
              { value: `${result.inserted.toLocaleString("en-US")}건`, label: "새로 저장" },
              { value: `${result.skipped.toLocaleString("en-US")}건`, label: "이미 있어서 건너뜀" },
              { value: `${result.errors.toLocaleString("en-US")}줄`, label: "오류로 뺌" },
            ].map((s) => (
              <div key={s.label} className="flex flex-col gap-0.5">
                <span className="text-2xl font-bold tabular-nums">{s.value}</span>
                <span className="text-[13px] text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>
          {dup ? (
            <p className="text-sm text-muted-foreground">이 파일의 리뷰는 전에 모두 저장해 두었어요. 새로 넣은 리뷰가 없어서 리포트는 그대로예요.</p>
          ) : (
            <MakingReport making={making.state} onRetry={making.retry} reportHref={`/reviews/${productId}`} />
          )}
          <NextSteps>
            <Link href={`/reviews/${productId}`} className={cn(moveLinkClass, "text-[15px]")}>
              이 제품 리포트 보기 →
            </Link>
            <Link href={importHref("competitor", { product: productId })} className={buttonVariants({ variant: "outline", size: "sm" })}>
              경쟁 제품 리뷰 가져오기
            </Link>
          </NextSteps>
        </SavedPanel>
      </div>
    );
  }

  if (stage === 2 && parsed && mapping) {
    const preview = checked.slice(0, PREVIEW_ROWS);
    const saving = progress !== null;
    return (
      <div className="space-y-6">
        <BigStepper steps={STEPS} current={2} />
        <SummaryBar
          action={
            <Button variant="outline" size="sm" onClick={resetFile} disabled={saving}>
              다른 파일 올리기
            </Button>
          }
        >
          <b className="font-medium">{productName}</b>
          <span className="text-muted-foreground">
            · {originLabel} · {parsed.fileName} · {parsed.rows.length.toLocaleString("en-US")}줄
          </span>
        </SummaryBar>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">열이 맞는지 확인하고 저장해 주세요</h2>
          <p className="text-sm text-muted-foreground">열 이름이 비슷하면 자동으로 연결했어요. 틀린 칸만 바꿔 주세요.</p>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {FIELDS.map((f) => (
            <SelectField key={f.key} label={f.required ? `${f.label} (필수)` : f.label}>
              <select className={bigSelectClass} value={mapping[f.key]} disabled={saving} onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}>
                <option value="">연결 안 함</option>
                {parsed.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </SelectField>
          ))}
        </div>

        {missing.length > 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            {missing.map((f) => f.label).join(" · ")} 열을 연결하면 미리보기가 보여요
          </p>
        ) : (
          <div className="space-y-2">
            <h3 className="text-base font-semibold">
              미리보기 <span className="text-[13px] font-normal text-muted-foreground">앞 {PREVIEW_ROWS}줄</span>
            </h3>
            <div className="overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    {FIELDS.map((f) => (
                      <TableHead key={f.key}>{f.label}</TableHead>
                    ))}
                    <TableHead>상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((r) => {
                    const cells = r.ok
                      ? { ...r.data, rating: String(r.data.rating), skin_type: r.data.skin_type ?? "", age_group: r.data.age_group ?? "" }
                      : r.raw;
                    return (
                      <TableRow key={r.line}>
                        {FIELDS.map((f) => (
                          <TableCell key={f.key} className={f.key === "body" ? "max-w-96 whitespace-normal" : undefined}>
                            {cells[f.key] || "—"}
                          </TableCell>
                        ))}
                        <TableCell>{r.ok ? <span className="text-status-approved">정상</span> : <span className="text-status-pending">{r.issues[0]}</span>}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {errorBox}

        <ActionBar
          label="저장할 리뷰"
          value={
            missing.length > 0
              ? "필수 열을 먼저 연결해 주세요"
              : `${valid.length.toLocaleString("en-US")}건${errorCount > 0 ? ` · 오류 ${errorCount.toLocaleString("en-US")}줄은 빼고 저장해요` : ""}`
          }
          note={progress ? `저장하는 중… ${progress.done.toLocaleString("en-US")} / ${progress.total.toLocaleString("en-US")}건` : "이미 저장된 리뷰는 다시 저장하지 않아요"}
        >
          <Button className={bigButtonClass} onClick={save} disabled={saving || valid.length === 0 || !product}>
            {saving ? "저장하는 중…" : `리뷰 ${valid.length.toLocaleString("en-US")}건 저장`}
          </Button>
        </ActionBar>
      </div>
    );
  }

  const fileReady = Boolean(product);
  return (
    <div className="space-y-6">
      <BigStepper steps={STEPS} current={1} />
      <div className="flex flex-col">
        <Question n="1" title="어느 제품의 리뷰인가요?" hint={picking ? "리뷰를 넣을 우리 제품을 골라 주세요." : "리포트에서 누른 제품이 미리 정해져 있어요."}>
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground">판매중인 우리 제품이 없어요. 프로젝트 화면에서 우리 제품을 판매중으로 등록하면 여기서 고를 수 있어요.</p>
          ) : picking ? (
            <>
              {wrongProduct && !productId && <p className="text-[13px] text-status-pending">주소의 제품을 찾지 못해 직접 골라 주세요</p>}
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="우리 제품 (판매중)">
                  <select
                    className={cn(bigSelectClass, wrongProduct && !productId && "border-status-pending")}
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                  >
                    <option value="">제품을 골라 주세요</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.brand} {p.name}
                      </option>
                    ))}
                  </select>
                </SelectField>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-base font-medium">{productName}</span>
              <span className="text-[13px] text-muted-foreground">{productSpec}</span>
              <Button variant="outline" size="sm" onClick={() => setPicking(true)}>
                다른 제품 고르기
              </Button>
            </div>
          )}
        </Question>

        <Question n="2" title="어디서 받은 리뷰인가요?" hint="올리브영·자사몰 관리자 화면에서 내려받은 CSV를 올려요.">
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="리뷰 출처">
              <select className={bigSelectClass} value={origin} onChange={(e) => setOrigin(e.target.value as ReviewImportOrigin)}>
                {ORIGINS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </SelectField>
          </div>
        </Question>

        <Question n="3" title="CSV 파일을 올려 주세요" hint="평점 · 본문 · 작성일 열이 있으면 돼요.">
          <label
            className={cn(
              "flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed text-sm text-muted-foreground",
              fileReady ? "cursor-pointer hover:bg-muted/30" : "opacity-50",
              dragging && "bg-muted/50",
            )}
            onDragOver={(e) => {
              if (!fileReady) return;
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (fileReady) handleFile(e.dataTransfer.files[0]);
            }}
          >
            <span>{fileReady ? "여기로 파일을 끌어오거나 눌러서 골라 주세요" : "제품을 먼저 골라 주세요"}</span>
            <input type="file" accept=".csv,text/csv" disabled={!fileReady} className="text-[13px]" onChange={(e) => handleFile(e.target.files?.[0])} />
          </label>
          <button type="button" className={cn(moveLinkClass, "self-start text-[13px]")} onClick={() => setShowSample(!showSample)}>
            CSV 양식 예시 {showSample ? "닫기" : "보기 →"}
          </button>
          {showSample && (
            <div className="space-y-1 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              <pre className="font-mono text-foreground">{SAMPLE.join("\n")}</pre>
              <p>UTF-8 CSV, 첫 줄은 열 이름이에요. 리뷰번호 · 피부타입 · 연령대 열은 없어도 돼요.</p>
            </div>
          )}
          {errorBox}
        </Question>
      </div>
    </div>
  );
}
