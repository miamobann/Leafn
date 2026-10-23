"use client";

// 콘텐츠 제작 가이드: 제품·채널을 고르면 제목 추천 3개(좌)·채널 양식 미리보기(우)·본문 추천(아래)을 보여준다.
// 화면 뼈대라 샘플 데이터만 쓴다. AI 호출·사진 업로드·저장·PDF 출력은 아직 없다.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fillProduct,
  GUIDE_CHANNELS,
  IG_MAX_SLIDES,
  POST_TYPES,
  X_CHAR_LIMIT,
  X_CHAR_RECOMMENDED,
  X_MAX_HASHTAGS,
  type GuideBlock,
  type GuideChannel,
  type GuideDraft,
  type PostType,
} from "../_lib/content-guide-samples";
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

/** 인스타그램: 4:5 세로형 캐러셀. 넘겨 보기 + 캡션·해시태그 */
type Fill = (text: string) => string;

function InstagramPreview({ blocks, hashtags, fill }: { blocks: GuideBlock[]; hashtags: string[]; fill: Fill }) {
  const slides = blocks.filter((b) => b.key.startsWith("slide"));
  const caption = blocks.find((b) => b.key === "caption");
  const [index, setIndex] = useState(0);
  const at = Math.min(index, slides.length - 1);
  const slide = slides[at];
  return (
    <div className="mx-auto max-w-sm rounded-md border">
      <p className="border-b px-3 py-2 text-sm font-semibold">leafand_official</p>
      {slide && (
        <div className="relative">
          <div className="flex aspect-[4/5] flex-col items-center justify-center gap-2 border-b-2 border-dashed p-6 text-center">
            <span className="text-xs text-muted-foreground">사진 자리 (업로드 준비 중)</span>
            <p className="whitespace-pre-line text-lg font-semibold" lang="ja">
              {fill(slide.options[0].text_ja)}
            </p>
            <p className="whitespace-pre-line text-xs text-muted-foreground">{fill(slide.options[0].text_ko)}</p>
          </div>
          {slides.length > 1 && (
            <div className="flex items-center justify-between px-3 py-2 text-xs">
              <Button type="button" variant="ghost" size="sm" disabled={at === 0} onClick={() => setIndex(at - 1)}>
                이전
              </Button>
              <span aria-live="polite">
                {at + 1} / {slides.length}
              </span>
              <Button type="button" variant="ghost" size="sm" disabled={at === slides.length - 1} onClick={() => setIndex(at + 1)}>
                다음
              </Button>
            </div>
          )}
        </div>
      )}
      <div className="space-y-1 p-3 text-sm">
        <p className="whitespace-pre-line" lang="ja">
          {caption ? fill(caption.options[0].text_ja) : ""}
        </p>
        <p className="text-primary" lang="ja">
          {hashtags.join(" ")}
        </p>
        <p className="text-xs text-muted-foreground">해시태그 {hashtags.length}개 (권장 10~18개)</p>
        <p className="whitespace-pre-line pt-1 text-xs text-muted-foreground">{caption ? fill(caption.options[0].text_ko) : ""}</p>
      </div>
    </div>
  );
}

/** 상세페이지(큐텐): Qoo10 상품 페이지 틀(헤더·썸네일·구매 박스·탭) 안에 블록을 세로로 이어 붙인다. 기본은 모바일 보기 */
function Qoo10Preview({ blocks, fill, productName }: { blocks: GuideBlock[]; fill: Fill; productName: string }) {
  const [mobile, setMobile] = useState(true);
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => setMobile((v) => !v)}>
          {mobile ? "PC 보기" : "모바일 보기"}
        </Button>
      </div>
      <div className={`mx-auto overflow-hidden bg-background text-sm ${mobile ? "max-w-sm rounded-[1.5rem] border-[6px] border-foreground/80" : "max-w-3xl rounded-md border"}`}>
        <div className="flex items-center justify-between border-b-2 border-primary px-3 py-2">
          <span className="text-lg font-black">Qoo10</span>
          <span className="text-xs text-muted-foreground">미리보기 (가상)</span>
        </div>
        <div className={`gap-4 border-b p-3 ${mobile ? "space-y-3" : "flex"}`}>
          <ImageSlot className={mobile ? "aspect-square" : "aspect-square w-64 shrink-0"} />
          <div className="flex-1 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Leaf& 公式ショップ</p>
            <p className="font-bold" lang="ja">
              {productName}
            </p>
            {/* 가격은 정가만 표시한다 (이중 가격 표시 X). 아직 정해지지 않아 価格未定 */}
            <div className="rounded-md bg-muted p-2">
              <p className="text-xs text-muted-foreground">価格</p>
              <p className="text-lg font-bold" lang="ja">
                価格未定
              </p>
            </div>
            <div className="flex gap-2">
              <span className="flex-1 rounded border py-2 text-center text-xs">カートに入れる</span>
              <span className="flex-1 rounded bg-primary py-2 text-center text-xs font-bold text-primary-foreground">今すぐ購入</span>
            </div>
          </div>
        </div>
        <div className="flex border-b-2 border-foreground/80 text-center text-xs font-semibold">
          <span className="flex-1 bg-foreground/80 py-2 text-background">商品詳細</span>
          <span className="flex-1 py-2 text-muted-foreground">レビュー</span>
          <span className="flex-1 py-2 text-muted-foreground">Q&A</span>
        </div>
        <div className="space-y-0 divide-y">
          {blocks.map((b) => (
            <section key={b.key} className={`space-y-2 p-3 ${b.needs_evidence ? "bg-muted/50" : ""}`}>
              <p className="text-[0.7rem] text-muted-foreground">{b.heading}</p>
              {b.needs_evidence ? (
                <div className="rounded-md border-2 border-dashed p-4 text-center text-xs text-muted-foreground">{fill(b.options[0].text_ko)}</div>
              ) : (
                <>
                  {b.has_image && <ImageSlot />}
                  <p className="whitespace-pre-line font-medium" lang="ja">
                    {fill(b.options[0].text_ja)}
                  </p>
                  <p className="whitespace-pre-line text-xs text-muted-foreground">{fill(b.options[0].text_ko)}</p>
                </>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function Preview({ channel, blocks, hashtags, fill, productName }: { channel: GuideChannel; blocks: GuideBlock[]; hashtags: string[]; fill: Fill; productName: string }) {
  const text = (b: GuideBlock | undefined) => (b ? fill(b.options[0].text_ja) : "");
  const ko = (b: GuideBlock | undefined) => (b ? fill(b.options[0].text_ko) : "");
  const find = (key: string) => blocks.find((b) => b.key === key);

  if (channel === "qoo10_detail") {
    return <Qoo10Preview blocks={blocks} fill={fill} productName={productName} />;
  }

  if (channel === "instagram") {
    return <InstagramPreview blocks={blocks} hashtags={hashtags} fill={fill} />;
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
            <p className={`text-right text-xs ${length > X_CHAR_LIMIT ? "text-destructive" : length > X_CHAR_RECOMMENDED ? "text-risk-medium" : "text-muted-foreground"}`}>
              {length}/{X_CHAR_LIMIT}자 (권장 {X_CHAR_RECOMMENDED}자 이내)
            </p>
            {hashtags.length > X_MAX_HASHTAGS && (
              <p className="text-xs text-risk-medium">해시태그가 {X_MAX_HASHTAGS}개를 넘으면 노출이 줄어요</p>
            )}
            <p className="text-xs text-muted-foreground">외부 링크는 본문이 아니라 첫 답글에 달아요</p>
            {find("terms") && (
              <div className="rounded-md border border-dashed p-2 text-xs">
                <p className="mb-1 text-muted-foreground">첫 답글 (응모 조건)</p>
                <p className="whitespace-pre-line" lang="ja">
                  {text(find("terms"))}
                </p>
              </div>
            )}
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
  const [postType, setPostType] = useState<PostType>("general");
  const [slideCount, setSlideCount] = useState(IG_MAX_SLIDES);

  const product = products.find((p) => p.id === productId) ?? products[0];
  const material = materials[product.id] ?? { hasReviews: false, appeals: [], keywords: [] };
  // 가장 추천을 맨 앞에 둔다
  const hasPostType = channel === "instagram" || channel === "x";
  const list = drafts
    .filter((d) => d.channel === channel && (!hasPostType || d.post_type === postType))
    .toSorted((a, b) => Number(b.recommended) - Number(a.recommended));
  const current = list.find((d) => d.id === selectedId) ?? list[0];
  // 리뷰가 없는 제품(개발 중)은 리뷰 블록을 뺀다
  const blocks = (current?.blocks ?? []).filter(
    (b) =>
      (!b.needs_reviews || material.hasReviews) &&
      // 인스타그램은 고른 장 수까지만 (1장 = 단일 게시물, 2~5장 = 캐러셀)
      (channel !== "instagram" || !b.key.startsWith("slide") || Number(b.key.slice(5)) <= slideCount),
  );
  const fill = (text: string) => fillProduct(text, product.name_ko, product.ingredients);
  // 개발 중 제품은 상세페이지를 아직 만들지 않는다
  const detailBlocked = channel === "qoo10_detail" && product.launch_status === "developing";

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
          {hasPostType && (
            <div className="flex flex-wrap gap-4">
              <div className="w-64">
                <label htmlFor="guide-post-type" className={LABEL}>
                  게시물 종류
                </label>
                <select
                  id="guide-post-type"
                  className={SELECT}
                  value={postType}
                  onChange={(e) => {
                    setPostType(POST_TYPES.find((t) => t.id === e.target.value)?.id ?? "general");
                    setSelectedId(null);
                  }}
                >
                  {POST_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              {channel === "instagram" && (
                <div className="w-48">
                  <label htmlFor="guide-slides" className={LABEL}>
                    사진 장 수
                  </label>
                  <select id="guide-slides" className={SELECT} value={slideCount} onChange={(e) => setSlideCount(Number(e.target.value))}>
                    {Array.from({ length: IG_MAX_SLIDES }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n === 1 ? "1장 (단일)" : `${n}장 (여러 장)`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
          <dl className="grid gap-1 rounded-md bg-muted p-3 text-sm sm:grid-cols-[7rem_1fr]">
            <dt className="font-medium">리뷰 소구점</dt>
            <dd>{material.hasReviews ? material.appeals.join(" · ") || "소구점 후보 없음" : "리뷰 없음 (개발 중 제품). 상세페이지의 리뷰 블록은 뺍니다"}</dd>
            <dt className="font-medium">검색어 순위</dt>
            <dd lang="ja">{material.keywords.map((k, i) => `${i + 1}. ${k}`).join("  ")}</dd>
            <dd className="text-xs text-muted-foreground sm:col-start-2">리뷰 분석·시장 분석의 가짜 데이터를 읽어 옵니다</dd>
          </dl>
        </CardContent>
      </Card>

      {detailBlocked ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          개발 중인 제품은 아직 상세페이지를 만들지 않아요. 출시된 스킨·에센스를 고르거나 다른 채널을 골라 주세요.
        </div>
      ) : (
        <>
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
              {current && (
                <Preview key={`${current.id}-${slideCount}`} channel={channel} blocks={blocks} hashtags={current.hashtags} fill={fill} productName={product.name_ko} />
              )}
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

        </>
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
