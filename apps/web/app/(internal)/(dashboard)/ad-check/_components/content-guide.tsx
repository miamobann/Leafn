"use client";

// 콘텐츠 제작 가이드: 제품·채널을 고르면 제목 추천 3개(좌)·채널 양식 미리보기(우)·본문 추천(아래)을 보여준다.
// 화면 뼈대라 샘플 데이터만 쓴다. AI 호출·사진 업로드·저장·PDF 출력은 아직 없다.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fillProduct, GUIDE_CHANNELS, X_CHAR_LIMIT, type GuideBlock, type GuideChannel, type GuideDraft } from "../_lib/content-guide-samples";
import type { LabProduct } from "../_lib/products";

const LABEL = "mb-1 block text-sm font-medium";
// shadcn select는 아직 설치되지 않아 기본 select를 같은 모양으로 쓴다 (components/ui는 공용 영역)
const SELECT = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";
// 좌(제목)·우(미리보기) 칸의 세로 길이를 같게 둔다. 내용이 길면 칸 안에서 스크롤한다
const PANEL_HEIGHT = "h-[32rem]";
const RECOMMENDED = "rounded px-1.5 text-xs bg-risk-low/15 text-risk-low";

/** 제품별로 반영한 재료 (리뷰 소구점 · 검색어 순위). 가짜 데이터 */
export type GuideMaterials = Record<string, { hasReviews: boolean; appeals: string[]; keywords: string[] }>;

type ContentGuideProps = {
  products: LabProduct[];
  drafts: GuideDraft[];
  materials: GuideMaterials;
};

/** 사진 자리. 업로드는 보류라 표시만 한다 */
function ImageSlot({ className = "aspect-video" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center rounded-md border-2 border-dashed text-xs text-muted-foreground ${className}`}>
      사진 자리 (업로드 준비 중)
    </div>
  );
}

function Preview({ channel, blocks, hashtags, productName }: { channel: GuideChannel; blocks: GuideBlock[]; hashtags: string[]; productName: string }) {
  const text = (b: GuideBlock | undefined) => (b ? fillProduct(b.options[0].text_ja, productName) : "");
  const ko = (b: GuideBlock | undefined) => (b ? fillProduct(b.options[0].text_ko, productName) : "");
  const find = (key: string) => blocks.find((b) => b.key === key);

  if (channel === "qoo10_detail") {
    return (
      <div className="mx-auto max-w-sm space-y-3">
        {blocks.map((b) => (
          <section key={b.key} className="space-y-2 rounded-md border p-3">
            <p className="text-xs text-muted-foreground">{b.heading}</p>
            {b.has_image && <ImageSlot />}
            <p className="whitespace-pre-line text-sm font-medium" lang="ja">
              {text(b)}
            </p>
            <p className="whitespace-pre-line text-xs text-muted-foreground">{ko(b)}</p>
          </section>
        ))}
      </div>
    );
  }

  if (channel === "instagram") {
    const caption = find("caption");
    return (
      <div className="mx-auto max-w-sm rounded-md border">
        <p className="border-b px-3 py-2 text-sm font-semibold">leafand_official</p>
        <ImageSlot className="aspect-square rounded-none border-x-0" />
        <div className="space-y-1 p-3 text-sm">
          <p className="whitespace-pre-line" lang="ja">
            {text(caption)}
          </p>
          <p className="text-blue-600 dark:text-blue-400" lang="ja">
            {hashtags.join(" ")}
          </p>
          <p className="whitespace-pre-line pt-1 text-xs text-muted-foreground">{ko(caption)}</p>
        </div>
      </div>
    );
  }

  if (channel === "x") {
    const post = find("post");
    const body = [text(post), ...hashtags.filter((h) => !text(post).includes(h))].join(" ").trim();
    const length = [...body].length;
    return (
      <div className="mx-auto max-w-md rounded-md border p-3">
        <div className="flex gap-3">
          <div className="size-10 shrink-0 rounded-full bg-muted" aria-hidden />
          <div className="min-w-0 flex-1 space-y-2 text-sm">
            <p className="font-semibold">
              Leaf& <span className="font-normal text-muted-foreground">@leafand_jp</span>
            </p>
            <p className="whitespace-pre-line" lang="ja">
              {body}
            </p>
            {find("image") && <ImageSlot />}
            <p className={`text-right text-xs ${length > X_CHAR_LIMIT ? "text-destructive" : "text-muted-foreground"}`}>
              {length}/{X_CHAR_LIMIT}자
            </p>
            <p className="whitespace-pre-line text-xs text-muted-foreground">{ko(post)}</p>
          </div>
        </div>
      </div>
    );
  }

  // banner: 가로형 한 종류 (어느 배너 광고에도 쓸 수 있게)
  const copy = find("copy");
  const sub = find("sub");
  return (
    <div className="space-y-2">
      <div className="relative flex aspect-[3/1] items-center rounded-md border-2 border-dashed p-6">
        <span className="absolute top-2 right-3 text-xs text-muted-foreground">사진 자리 (업로드 준비 중)</span>
        <div>
          <p className="text-xl font-semibold" lang="ja">
            {text(copy)}
          </p>
          <p className="mt-1 text-sm" lang="ja">
            {text(sub)}
          </p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {ko(copy)} · {ko(sub)}
      </p>
    </div>
  );
}

export function ContentGuide({ products, drafts, materials }: ContentGuideProps) {
  const [productId, setProductId] = useState(products[0].id);
  const [channel, setChannel] = useState<GuideChannel>("qoo10_detail");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const product = products.find((p) => p.id === productId) ?? products[0];
  const material = materials[product.id] ?? { hasReviews: false, appeals: [], keywords: [] };
  // 가장 추천을 맨 앞에 둔다
  const list = drafts.filter((d) => d.channel === channel).toSorted((a, b) => Number(b.recommended) - Number(a.recommended));
  const current = list.find((d) => d.id === selectedId) ?? list[0];
  // 리뷰가 없는 제품(개발 중)은 리뷰 블록을 뺀다
  const blocks = (current?.blocks ?? []).filter((b) => !b.needs_reviews || material.hasReviews);
  const fill = (text: string) => fillProduct(text, product.name_ko);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4">
          <div className="max-w-sm">
            <label htmlFor="guide-product" className={LABEL}>
              제품
            </label>
            <select id="guide-product" className={SELECT} value={productId} onChange={(e) => setProductId(e.target.value)}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name_ko} ({p.line}
                  {p.launch_status === "developing" ? " · 개발 중" : ""})
                </option>
              ))}
            </select>
          </div>
          <div role="tablist" aria-label="채널" className="flex flex-wrap gap-2">
            {GUIDE_CHANNELS.map((ch) => (
              <button
                key={ch.id}
                type="button"
                role="tab"
                aria-selected={channel === ch.id}
                onClick={() => {
                  setChannel(ch.id);
                  setSelectedId(null);
                }}
                className={`rounded-full border px-3 py-1 text-sm ${channel === ch.id ? "border-foreground bg-muted font-medium" : "text-muted-foreground hover:bg-muted"}`}
              >
                {ch.label}
              </button>
            ))}
          </div>
          <dl className="grid gap-1 rounded-md bg-muted p-3 text-sm sm:grid-cols-[7rem_1fr]">
            <dt className="font-medium">리뷰 소구점</dt>
            <dd>{material.hasReviews ? material.appeals.join(" · ") || "소구점 후보 없음" : "리뷰 없음 (개발 중 제품). 상세페이지의 리뷰 블록은 뺍니다"}</dd>
            <dt className="font-medium">검색어 순위</dt>
            <dd lang="ja">{material.keywords.map((k, i) => `${i + 1}. ${k}`).join("  ")}</dd>
            <dd className="text-xs text-muted-foreground sm:col-start-2">리뷰 분석·시장 분석의 가짜 데이터를 읽어 옵니다</dd>
          </dl>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>제목 추천</CardTitle>
          </CardHeader>
          <CardContent className={`${PANEL_HEIGHT} overflow-y-auto`}>
            <ol className="space-y-2">
              {list.map((d, i) => {
                const selected = d.id === current?.id;
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setSelectedId(d.id)}
                      className={`w-full rounded-md border p-3 text-left text-sm hover:bg-muted ${selected ? "border-foreground bg-muted" : ""}`}
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        {d.recommended && <span className={RECOMMENDED}>가장 추천</span>}
                        <span className="font-medium" lang="ja">
                          {i + 1}. {d.title_ja}
                        </span>
                      </span>
                      <span className="mt-1 block text-muted-foreground">{d.title_ko}</span>
                      <span className="mt-2 block border-t pt-2 text-xs text-muted-foreground">
                        {d.recommended ? "추천 이유" : "참고"}: {d.reason}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>미리보기</CardTitle>
          </CardHeader>
          <CardContent className={`${PANEL_HEIGHT} overflow-y-auto`} role="region" aria-label="결과물 미리보기" tabIndex={0}>
            {current && <Preview channel={channel} blocks={blocks} hashtags={current.hashtags} productName={product.name_ko} />}
          </CardContent>
        </Card>
      </div>

      {current && (
        <Card>
          <CardHeader>
            <CardTitle>본문 추천</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <ol className="space-y-3">
              {blocks.map((b, i) => (
                <li key={b.key} className="rounded-md border p-3">
                  <p className="font-semibold">
                    {blocks.length > 1 ? `${i + 1}. ` : ""}
                    {b.heading}
                  </p>
                  {b.options.map((o, j) => (
                    <div key={o.text_ja} className={`mt-2 ${j === 0 ? "" : "border-t pt-2"}`}>
                      <p className="mb-1">{j === 0 ? <span className={RECOMMENDED}>가장 추천</span> : <span className="text-xs text-muted-foreground">다른 안</span>}</p>
                      <p className="whitespace-pre-line" lang="ja">
                        {fill(o.text_ja)}
                      </p>
                      <p className="whitespace-pre-line text-muted-foreground">한국어: {fill(o.text_ko)}</p>
                      {j === 0 && <p className="mt-1 text-xs text-muted-foreground">추천 이유: {b.reason}</p>}
                    </div>
                  ))}
                </li>
              ))}
            </ol>
            <section className="rounded-md bg-muted p-3">
              <h3 className="mb-1 font-semibold">AI에 넣을 프롬프트 가이드</h3>
              <p className="whitespace-pre-line">{current.prompt_guide}</p>
            </section>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-muted-foreground">다른 부서 공유용 · 준비 중</span>
        <Button type="button" disabled>
          PDF 출력
        </Button>
      </div>
    </div>
  );
}
