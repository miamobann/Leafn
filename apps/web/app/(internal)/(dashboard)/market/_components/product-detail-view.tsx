"use client";

import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { platformLabel } from "@/lib/platforms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DetailTemplate } from "@/components/templates";
import { formatJpy } from "@/lib/format";
import { pricePerMl, readListing, type Product } from "@/lib/schemas/product";
import { TrendLineChart } from "@/app/(internal)/(dashboard)/market/_components/charts";

const COPY = {
  edit: "값 수정",
  cancel: "편집 취소",
  apply: "적용",
  unsaved: "수정됨 · 저장 안 됨",
  editNote: "적용한 값은 이 화면에서만 바뀌고 저장되지 않아요",
  noRank: "楽天 랭킹에 없는 제품이에요 (Qoo10 판매 제품은 楽天 랭킹에 나오지 않아요)",
  ingredientsNote: "표기 순서 · 진한 칸 = 자사 제품에도 있는 성분 (물·BG·글리세린·보존제 제외)",
};

type RankPoint = { week: string; rank: number };

export function ProductDetailView({
  product,
  sharedWithOwn,
  rank,
  geoMentions,
  geoTotal,
}: {
  product: Product;
  sharedWithOwn: string[];
  rank: { category: string; points: RankPoint[] } | null;
  geoMentions: number;
  geoTotal: number;
}) {
  const [p, setP] = useState(product);
  const [edited, setEdited] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ price: "", sale: "", volume: "", features: "" });
  const [error, setError] = useState("");
  const listing = readListing(p);
  const shared = new Set(sharedWithOwn);

  function startEdit() {
    setDraft({
      price: p.price_jpy?.toString() ?? "",
      sale: listing?.sale_price_jpy?.toString() ?? "",
      volume: p.volume_ml?.toString() ?? "",
      features: p.features.join("\n"),
    });
    setError("");
    setEditing(true);
  }

  function apply() {
    const price = draft.price === "" ? null : Number(draft.price);
    const sale = draft.sale === "" ? null : Number(draft.sale);
    const volume = draft.volume === "" ? null : Number(draft.volume);
    if ((price !== null && !(price > 0)) || (volume !== null && !(volume > 0))) return setError("정가와 용량은 0보다 큰 숫자여야 해요");
    if (sale !== null && (!(sale > 0) || (price !== null && sale >= price))) return setError("행사가는 0보다 크고 정가보다 낮아야 해요");
    setP({
      ...p,
      price_jpy: price,
      volume_ml: volume,
      features: draft.features.split("\n").map((x) => x.trim()).filter(Boolean),
      source_raw: { ...(p.source_raw ?? {}), sale_price_jpy: sale, sale_label: sale === null ? null : (listing?.sale_label ?? "행사가") },
    });
    setEdited(true);
    setEditing(false);
  }

  const perMl = pricePerMl(p);

  return (
    <>
      {editing && (
        <div className="mb-4 space-y-3 rounded-lg border p-4">
          <div className="grid grid-cols-3 gap-3">
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              税込 정가 (円)
              <Input type="number" min={1} value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              행사가 (円, 없으면 비움)
              <Input type="number" min={1} value={draft.sale} onChange={(e) => setDraft({ ...draft, sale: e.target.value })} />
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              용량 (ml)
              <Input type="number" min={1} value={draft.volume} onChange={(e) => setDraft({ ...draft, volume: e.target.value })} />
            </label>
            <label className="col-span-3 grid gap-1 text-xs font-medium text-muted-foreground">
              특징 (줄마다 하나)
              <Textarea value={draft.features} onChange={(e) => setDraft({ ...draft, features: e.target.value })} />
            </label>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={apply}>
              {COPY.apply}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
              {COPY.cancel}
            </Button>
            <span className="text-xs text-muted-foreground">{COPY.editNote}</span>
          </div>
        </div>
      )}
      <DetailTemplate
        badges={
          <>
            <Badge>{p.kind === "own" ? "자사" : "경쟁"}</Badge>
            <Badge variant="secondary">{platformLabel(p.platform)}</Badge>
            {p.category && (
              <Badge variant="outline">
                <span lang="ja">{p.category}</span>
              </Badge>
            )}
            {edited && <Badge variant="outline">{COPY.unsaved}</Badge>}
            {!editing && (
              <Button size="xs" variant="outline" onClick={startEdit}>
                {COPY.edit}
              </Button>
            )}
          </>
        }
        attributes={[
          { label: "税込 정가", value: formatJpy(p.price_jpy) },
          { label: "행사가", value: listing?.sale_price_jpy != null ? `${listing.sale_label ?? "행사가"} ${formatJpy(listing.sale_price_jpy)}` : "없음" },
          { label: "용량", value: p.volume_ml ? `${p.volume_ml}ml` : "—" },
          { label: "ml당 가격", value: perMl != null ? `¥${perMl} (정가 ÷ 용량)` : "—" },
          { label: "평점", value: listing?.rating != null ? `${listing.rating.toFixed(1)} / ${listing.rating_scale}` : "—" },
          { label: "리뷰 수", value: listing ? `${listing.review_count.toLocaleString("ko-KR")}건` : "—" },
          { label: "AI 검색 언급", value: `답변 ${geoTotal}건 중 ${geoMentions}건` },
        ]}
        sections={[
          {
            title: "全成分",
            content: (
              <>
                <p className="mb-2 text-xs text-muted-foreground">{COPY.ingredientsNote}</p>
                <ul lang="ja" className="flex flex-wrap gap-1">
                  {p.ingredients.map((x) => (
                    <li key={x}>
                      <Badge variant={shared.has(x) ? "default" : "outline"}>{x}</Badge>
                    </li>
                  ))}
                </ul>
              </>
            ),
          },
          {
            title: "특징",
            content: (
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {p.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            ),
          },
          {
            title: "楽天 랭킹 순위 추이",
            content: rank ? (
              <>
                <p className="mb-2 text-xs text-muted-foreground">
                  <span lang="ja">{rank.category}</span> · 12주 · 위로 갈수록 높은 순위
                </p>
                <TrendLineChart data={rank.points} series={[{ key: "rank", label: "순위", color: "var(--primary)", emphasis: true }]} unit="위" reversed height={220} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{COPY.noRank}</p>
            ),
          },
          {
            title: "출처",
            content: (
              <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
                <dt className="text-muted-foreground">상품 페이지</dt>
                <dd className="break-all">
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                      {p.url}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
                <dt className="text-muted-foreground">수집 시각</dt>
                <dd>{listing ? `${listing.captured_at.slice(0, 16).replace("T", " ")} JST (샘플)` : "—"}</dd>
              </dl>
            ),
          },
          {
            title: "추출 원본 (source_raw)",
            content: (
              <details>
                <summary className="cursor-pointer text-sm">펼쳐 보기</summary>
                <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(p.source_raw, null, 2)}</pre>
              </details>
            ),
          },
        ]}
      />
    </>
  );
}
