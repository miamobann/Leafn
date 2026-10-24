"use client";

// 콘텐츠 제작 가이드: 제품·채널(·게시물 종류)을 고르고 「제작하기」를 누르면 제목 추천 3개(좌)가 나오고,
// 제목을 고르면 그 제목으로 채널 양식 미리보기(우)·본문 추천(아래)이 나온다 (AI 연결 후의 2단계 흐름).
// 화면 뼈대라 샘플 데이터를 짧게 기다렸다 보여 준다. AI 호출·사진 업로드·저장·PDF 출력은 아직 없다.
// 블록 메모는 화면에만 두고(저장 안 함) PDF 출력에 함께 넣을 예정이다.
// 사진 칸에는 어떤 사진이 들어갈지 설명만 보여 준다.
import { Bell, ChevronLeft, ChevronRight, Heart, Search, ShoppingCart, Store } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EmptyState, LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  fillProduct,
  GUIDE_CHANNELS,
  HASHTAG_GROUPS,
  IG_HASHTAG_LIMIT,
  IG_MAX_SLIDES,
  keywordToHashtag,
  POST_TYPES,
  SNS_ACCOUNTS,
  X_CHAR_LIMIT,
  X_CHAR_RECOMMENDED,
  X_MAX_HASHTAGS,
  type GalleryShot,
  type GuideBlock,
  type GuideChannel,
  type GuideDraft,
  type Hashtags,
  type PostType,
} from "../_lib/content-guide-samples";
import type { LabProduct } from "../_lib/products";
import { buildCutList, PHOTO_DONTS, PHOTO_RULES } from "../_lib/photo-guide";
import { ContentGuideReport, memoLocation, type ReportAuthor } from "./content-guide-report";

const LABEL = "mb-1 block text-sm font-medium";
// shadcn select는 아직 설치되지 않아 기본 select를 같은 모양으로 쓴다 (components/ui는 공용 영역)
const SELECT = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";
// 좌(제목)·우(미리보기) 칸의 세로 길이를 같게 둔다. 내용이 길면 칸 안에서 스크롤한다
const PANEL_HEIGHT = "h-[32rem]";
const RECOMMENDED = "rounded px-1.5 text-xs bg-risk-low/15 text-risk-low";
/** 인스타그램 해시태그에 붙일 검색어 태그 수 (시장 분석 검색어 1위) */
const KEYWORD_TAGS = 1;
/** AI 연결 전, 생성 순서를 보여 주려고 샘플을 띄우기 전에 잠깐 기다리는 시간 */
const SAMPLE_DELAY_MS = 700;

/** 제품별로 반영한 재료 (리뷰 소구점 · 검색어 순위). 가짜 데이터 */
export type GuideMaterials = Record<string, { hasReviews: boolean; appeals: string[]; keywords: string[] }>;

type ContentGuideProps = {
  products: LabProduct[];
  drafts: GuideDraft[];
  materials: GuideMaterials;
  /** PDF 머리글의 작성자 (로그인한 사람 이름 · 팀) */
  author: ReportAuthor;
};

type Fill = (text: string) => string;

/** 사진 칸. 업로드는 보류라 「어떤 사진이 들어갈지」 설명만 보여 준다 */
function ImageSlot({ image, className = "aspect-video" }: { image?: string | null; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed p-3 text-center text-xs text-muted-foreground ${className}`}>
      <span className="font-medium">사진</span>
      <span>{image ?? "사진 자리"}</span>
    </div>
  );
}

function HashtagChips({ tags }: { tags: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1" lang="ja">
      {tags.map((t) => (
        <li key={t} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
          {t}
        </li>
      ))}
    </ul>
  );
}

/** 넘기기 화살표 (칸의 양 끝 가운데에 겹쳐 둔다) */
function PagerArrow({ side, label, disabled, onClick }: { side: "left" | "right"; label: string; disabled: boolean; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`absolute top-1/2 ${side === "left" ? "left-2" : "right-2"} flex size-8 -translate-y-1/2 items-center justify-center rounded-full border bg-background/90 shadow disabled:opacity-0`}
    >
      <Icon className="size-5" aria-hidden />
    </button>
  );
}

function PagerDots({ count, at }: { count: number; at: number }) {
  return (
    <div className="flex justify-center gap-1 py-2" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={`size-1.5 rounded-full ${i === at ? "bg-primary" : "bg-muted-foreground/40"}`} />
      ))}
    </div>
  );
}

/** 본문 추천: 블록을 한 장씩 옆으로 넘기며 본다 (블록이 많은 상세페이지·여러 장 SNS가 길어지지 않게) */
function BodyPager({
  blocks,
  fill,
  memos,
  onMemo,
  memoWhere,
}: {
  blocks: GuideBlock[];
  fill: Fill;
  /** 블록 key → 메모 */
  memos: Record<string, string>;
  onMemo: (blockKey: string, text: string) => void;
  /** 이 블록의 메모가 PDF 어디에 나오는지 */
  memoWhere: (blockKey: string) => string;
}) {
  const [index, setIndex] = useState(0);
  const at = Math.min(index, blocks.length - 1);
  const b = blocks[at];
  if (!b) return null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="본문 블록">
        {blocks.map((x, i) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            aria-selected={i === at}
            onClick={() => setIndex(i)}
            className={`rounded-full border px-2 py-0.5 text-xs ${i === at ? "border-foreground bg-muted font-medium" : "text-muted-foreground hover:bg-muted"}`}
          >
            {i + 1}. {x.heading}
            {memos[x.key] && <span className="text-primary"> · 메모</span>}
          </button>
        ))}
      </div>
      {/* 높이를 고정해 넘길 때 칸·버튼이 위아래로 움직이지 않게 한다. 글이 길면 칸 안에서 스크롤 */}
      <div className="h-80 rounded-md border">
        <div className="h-full overflow-y-auto px-4 py-4" role="region" aria-label="본문 블록 내용" tabIndex={0}>
        <p className="font-semibold">
          {at + 1}/{blocks.length} · {b.heading}
        </p>
        {b.image && <p className="mt-1 text-xs text-muted-foreground">사진: {b.image}</p>}
        {b.options
          .filter((o) => o.text_ja)
          .map((o, j) => (
            <div key={o.text_ja} className={`mt-2 ${j === 0 ? "" : "border-t pt-2"}`}>
              <p className="mb-1">{j === 0 ? <span className={RECOMMENDED}>가장 추천</span> : <span className="text-xs text-muted-foreground">다른 안</span>}</p>
              <p className="whitespace-pre-line" lang="ja">
                {fill(o.text_ja)}
              </p>
              <p className="whitespace-pre-line text-muted-foreground">한국어: {fill(o.text_ko)}</p>
            </div>
          ))}
        <p className="mt-2 text-xs text-muted-foreground">추천 이유: {b.reason}</p>
        </div>
      </div>
      {/* 넘기기 버튼은 칸 아래 가운데에 모은다 (양 끝에 두면 검토하며 오가기 불편해서) */}
      {blocks.length > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button type="button" variant="outline" size="sm" disabled={at === 0} onClick={() => setIndex(at - 1)}>
            <ChevronLeft aria-hidden />
            이전
          </Button>
          <span className="min-w-14 text-center text-sm tabular-nums" aria-live="polite">
            {at + 1} / {blocks.length}
          </span>
          <Button type="button" variant="outline" size="sm" disabled={at === blocks.length - 1} onClick={() => setIndex(at + 1)}>
            다음
            <ChevronRight aria-hidden />
          </Button>
        </div>
      )}
      <div>
        <label htmlFor="guide-block-memo" className={LABEL}>
          메모 · {at + 1}. {b.heading}
        </label>
        <Textarea
          id="guide-block-memo"
          value={memos[b.key] ?? ""}
          onChange={(e) => onMemo(b.key, e.target.value)}
          placeholder="이 블록에 대한 검토 의견을 적어 주세요"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          PDF에서는 <span className="font-medium text-foreground">{memoWhere(b.key)}</span>에 적혀요 · 아직 저장되지 않아 새로고침하거나 다시 제작하면 사라져요.
        </p>
      </div>
    </div>
  );
}

/** 인스타그램: 4:5 세로형 캐러셀. 넘겨 보기 + 캡션·해시태그 */
function InstagramPreview({ blocks, hashtags, fill }: { blocks: GuideBlock[]; hashtags: string[]; fill: Fill }) {
  const slides = blocks.filter((b) => b.key.startsWith("slide"));
  const caption = blocks.find((b) => b.key === "caption");
  const [index, setIndex] = useState(0);
  const at = Math.min(index, slides.length - 1);
  const slide = slides[at];
  return (
    <div className="mx-auto max-w-sm rounded-md border">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span className="size-7 rounded-full bg-muted" aria-hidden />
        <span className="text-sm font-semibold">{SNS_ACCOUNTS.instagram.handle}</span>
      </div>
      {slide && (
        <div>
          <div className="relative flex aspect-[4/5] flex-col items-center justify-center gap-3 border-b p-6 text-center">
            <ImageSlot image={slide.image} className="w-full flex-1" />
            <p className="whitespace-pre-line text-lg font-semibold" lang="ja">
              {fill(slide.options[0].text_ja)}
            </p>
            <p className="whitespace-pre-line text-xs text-muted-foreground">{fill(slide.options[0].text_ko)}</p>
            {slides.length > 1 && (
              <>
                {/* 인스타그램처럼 사진 양 끝 화살표로 넘긴다 */}
                <PagerArrow side="left" label="이전 사진" disabled={at === 0} onClick={() => setIndex(at - 1)} />
                <PagerArrow side="right" label="다음 사진" disabled={at === slides.length - 1} onClick={() => setIndex(at + 1)} />
                <span className="absolute top-2 right-2 rounded-full bg-foreground/70 px-2 py-0.5 text-[0.65rem] text-background" aria-live="polite">
                  {at + 1}/{slides.length}
                </span>
              </>
            )}
          </div>
          {slides.length > 1 && <PagerDots count={slides.length} at={at} />}
        </div>
      )}
      <div className="space-y-2 p-3 text-sm">
        <p>
          <span className="mr-1 font-semibold">{SNS_ACCOUNTS.instagram.handle}</span>
          <span className="whitespace-pre-line" lang="ja">
            {caption ? fill(caption.options[0].text_ja) : ""}
          </span>
        </p>
        <HashtagChips tags={hashtags} />
        <p className="text-xs text-muted-foreground">해시태그 {hashtags.length}개 (기준 {IG_HASHTAG_LIMIT}개)</p>
        <p className="whitespace-pre-line border-t pt-2 text-xs text-muted-foreground">{caption ? fill(caption.options[0].text_ko) : ""}</p>
      </div>
    </div>
  );
}

/** 상세페이지 블록을 위아래 틈 없이 이어 붙인다 (Qoo10 #div_inner_contents 처럼) */
function DetailSlices({ blocks, fill }: { blocks: GuideBlock[]; fill: Fill }) {
  return (
    <div>
      {blocks.map((b) => (
        <section key={b.key} className={`space-y-2 px-4 py-5 text-center ${b.needs_evidence ? "bg-muted/50" : ""}`}>
          <p className="text-[0.65rem] tracking-wide text-muted-foreground">{b.heading}</p>
          {b.needs_evidence ? (
            <div className="rounded-md border-2 border-dashed p-4 text-xs text-muted-foreground">{fill(b.options[0].text_ko)}</div>
          ) : (
            <>
              {b.image && <ImageSlot image={b.image} />}
              <p className="whitespace-pre-line font-medium" lang="ja">
                {fill(b.options[0].text_ja)}
              </p>
              <p className="whitespace-pre-line text-xs text-muted-foreground">{fill(b.options[0].text_ko)}</p>
            </>
          )}
        </section>
      ))}
    </div>
  );
}

/** 제품명 앞의 브랜드(Leaf&)는 따로 강조해서 보여 주므로 뗀다 */
const withoutBrand = (name: string) => name.replace(/^Leaf&\s*/, "");

type Qoo10Props = { blocks: GuideBlock[]; gallery: GalleryShot[]; fill: Fill; productName: string; category: string };

/** 대표 이미지 갤러리 (정사각형). 실제 큐텐처럼 사진 양 끝 화살표 + 「n / 전체」 */
function GalleryViewer({ gallery, className = "" }: { gallery: GalleryShot[]; className?: string }) {
  const [index, setIndex] = useState(0);
  const at = Math.min(index, Math.max(gallery.length - 1, 0));
  const shot = gallery[at];
  return (
    <div className={`relative ${className}`}>
      <ImageSlot image={shot ? `대표 이미지 ${at + 1} · ${shot.role}\n${shot.image}` : null} className="aspect-square rounded-none border-x-0 border-t-0 whitespace-pre-line" />
      {gallery.length > 1 && (
        <>
          <PagerArrow side="left" label="이전 대표 이미지" disabled={at === 0} onClick={() => setIndex(at - 1)} />
          <PagerArrow side="right" label="다음 대표 이미지" disabled={at === gallery.length - 1} onClick={() => setIndex(at + 1)} />
        </>
      )}
      <span className="absolute right-3 bottom-3 rounded-full bg-foreground/70 px-2 py-0.5 text-[0.65rem] text-background">
        {at + 1} / {gallery.length || 1}
      </span>
    </div>
  );
}

/** 본문 추천 위에 두는 대표 이미지 안내: 첫 장은 자세히, 나머지는 역할만 */
function GalleryGuide({ gallery }: { gallery: GalleryShot[] }) {
  const [first, ...rest] = gallery;
  if (!first) return null;
  return (
    <section className="space-y-2 rounded-md border p-3">
      <h3 className="font-semibold">대표 이미지 갤러리 (정사각형 1:1 · {gallery.length}장)</h3>
      <p className="text-xs text-muted-foreground">상품 페이지 맨 위에서 옆으로 넘기는 사진이에요. 첫 장은 검색 결과 목록의 썸네일로 쓰여요. 디자이너가 장 수를 늘려도 돼요.</p>
      <div className="rounded-md bg-muted p-2">
        <p className="font-medium">
          1. {first.role} — {first.image}
        </p>
        <ul className="mt-1 list-disc pl-5 text-xs">
          {first.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
      <ol className="grid gap-1 text-xs sm:grid-cols-2">
        {rest.map((g, i) => (
          <li key={g.role}>
            {i + 2}. <span className="font-medium">{g.role}</span> — {g.image}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** 가격은 정가만 (이중 가격 표시 X). 아직 정해지지 않아 価格未定. 할인·쿠폰·送料無料·プレゼント 표시는 근거가 없어 넣지 않는다 */
function PriceBox() {
  return (
    <div className="border-b pb-3">
      <p className="text-xs text-muted-foreground">価格</p>
      <p className="text-xl font-black" lang="ja">
        価格未定
      </p>
    </div>
  );
}

/** Qoo10 모바일 앱 상품 페이지 틀 (팀이 만든 목업 기준) */
function Qoo10Mobile({ blocks, gallery, fill, productName, category }: Qoo10Props) {
  const hook = blocks.find((b) => b.key === "hook");
  const banner = hook?.options[0].text_ja.split("\n").filter((l) => !l.startsWith("*")).join(" ").replaceAll("*", "") ?? "";
  return (
    <div className="mx-auto max-w-sm overflow-hidden rounded-[1.5rem] border-[6px] border-foreground/80 bg-background text-sm" lang="ja">
      <div className="flex h-11 items-center justify-between border-b px-3">
        <span className="flex items-center gap-2 font-bold">
          <ChevronLeft className="size-5" aria-hidden />
          <Store className="size-4" aria-hidden />
          Leaf& 公式ショップ
        </span>
        <span className="flex gap-3" aria-hidden>
          <Bell className="size-5" />
          <Search className="size-5" />
          <ShoppingCart className="size-5" />
        </span>
      </div>
      <GalleryViewer gallery={gallery} />
      <p className="truncate bg-primary px-3 py-1.5 text-center text-xs font-bold text-primary-foreground">{fill(banner)}</p>
      <div className="space-y-2 p-3">
        <span className="inline-block rounded-sm bg-primary px-1.5 text-[0.65rem] font-bold text-primary-foreground">公式ショップ</span>
        <p className="font-semibold">
          <span className="mr-1 text-primary">Leaf&</span>
          {withoutBrand(productName)}
        </p>
        <PriceBox />
      </div>
      <p className="bg-muted-foreground px-3 py-2 text-xs text-background">スキンケア &gt; 基礎化粧品 &gt; {category}</p>
      <div className="flex border-b text-center text-xs">
        <span className="flex-1 border-b-2 border-foreground py-3 font-bold">商品情報</span>
        <span className="flex-1 py-3 text-muted-foreground">お知らせ・Q&A</span>
        <span className="flex-1 py-3 text-muted-foreground">レビュー</span>
      </div>
      <div className="flex items-center justify-between px-3 py-3">
        <span className="font-bold">商品説明</span>
        <span className="text-[0.65rem] text-muted-foreground">商品番号 : 未定</span>
      </div>
      <DetailSlices blocks={blocks} fill={fill} />
      <div className="sticky bottom-0 flex h-12 items-center gap-2 border-t bg-background px-2">
        <Heart className="size-5 text-muted-foreground" aria-hidden />
        <span className="flex-1 rounded border py-2 text-center text-xs font-bold">カート</span>
        <span className="flex-[1.3] rounded bg-primary py-2 text-center text-xs font-bold text-primary-foreground">今すぐ購入</span>
      </div>
    </div>
  );
}

/** Qoo10 PC 상품 페이지 틀 (모달에서 크게 본다). 실제 PC 화면 배치를 따르되 근거 없는 평점·할인·배송 문구는 넣지 않는다 */
function Qoo10Pc({ blocks, gallery, fill, productName, category }: Qoo10Props) {
  return (
    <div className="mx-auto max-w-5xl overflow-hidden rounded-md border bg-background text-sm" lang="ja">
      <div className="flex items-center gap-6 border-b px-6 py-3">
        <span className="text-2xl font-black text-primary">Qoo10</span>
        <span className="flex h-9 flex-1 items-center justify-between rounded-md border border-primary/60 px-3 text-xs text-muted-foreground">
          Qoo10で商品を探してみよう！
          <Search className="size-4" aria-hidden />
        </span>
        <span className="flex gap-4" aria-hidden>
          <Bell className="size-5" />
          <ShoppingCart className="size-5" />
        </span>
      </div>
      <p className="px-6 py-3 text-xs text-muted-foreground">スキンケア &gt; 基礎化粧品 &gt; {category}</p>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-8 px-6 pb-6">
        <div className="space-y-3">
          <GalleryViewer gallery={gallery} className="overflow-hidden rounded-md border" />
          <div className="flex items-center justify-between border-b pb-2">
            <span className="font-bold">ショップ情報</span>
            <span className="text-xs text-muted-foreground">ショップへ &gt;</span>
          </div>
          <p className="flex items-center gap-2">
            <Store className="size-4" aria-hidden />
            Leaf& 公式ショップ
          </p>
        </div>
        <div className="space-y-3">
          <span className="inline-block rounded-sm bg-primary px-1.5 text-xs font-bold text-primary-foreground">公式ショップ</span>
          <p className="text-lg leading-snug">
            <span className="mr-1 font-bold text-primary">Leaf&</span>
            {withoutBrand(productName)}
          </p>
          <PriceBox />
          <div className="flex items-center justify-between border-b pb-3 text-xs">
            <span className="font-medium">レビュー</span>
            <span className="text-muted-foreground">販売開始後に表示</span>
          </div>
          <div className="flex items-center justify-between border-b pb-3 text-xs">
            <span className="font-medium">配送情報</span>
            <span className="text-muted-foreground">未定</span>
          </div>
          <div className="flex gap-2">
            <span className="flex-1 rounded border py-3 text-center font-bold">カートに入れる</span>
            <span className="flex-[1.5] rounded bg-primary py-3 text-center font-bold text-primary-foreground">今すぐ購入</span>
          </div>
        </div>
      </div>
      <div className="flex border-y text-center text-sm font-bold">
        <span className="flex-1 border-b-2 border-foreground py-3">商品詳細</span>
        <span className="flex-1 py-3 text-muted-foreground">レビュー</span>
        <span className="flex-1 py-3 text-muted-foreground">Q&A</span>
      </div>
      <div className="mx-auto max-w-2xl">
        <DetailSlices blocks={blocks} fill={fill} />
      </div>
    </div>
  );
}

/** 상세페이지(큐텐): 칸 안에서는 모바일, 「PC로 크게 보기」를 누르면 모달로 PC 화면을 크게 본다 */
function Qoo10Preview(props: Qoo10Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => dialog.current?.showModal()}>
          PC로 크게 보기
        </Button>
      </div>
      <Qoo10Mobile {...props} />
      <dialog
        ref={dialog}
        aria-label="PC 상세페이지 미리보기"
        className="m-auto max-h-[90vh] w-[min(64rem,95vw)] overflow-y-auto rounded-lg bg-background p-4 text-foreground backdrop:bg-foreground/50"
        // 바깥(배경)을 누르면 닫는다
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="font-semibold">PC 상세페이지 미리보기 (가상)</p>
          <Button type="button" variant="outline" size="sm" onClick={() => dialog.current?.close()}>
            닫기
          </Button>
        </div>
        <Qoo10Pc {...props} />
      </dialog>
    </div>
  );
}

function XPreview({ blocks, hashtags, fill }: { blocks: GuideBlock[]; hashtags: string[]; fill: Fill }) {
  const post = blocks.find((b) => b.key === "post");
  const image = blocks.find((b) => b.key === "image");
  const text = post ? fill(post.options[0].text_ja) : "";
  const body = [text, hashtags.join(" ")].join("\n").trim();
  const length = [...body].length;
  return (
    <div className="mx-auto max-w-md rounded-md border p-3">
      <div className="flex gap-3">
        <div className="size-10 shrink-0 rounded-full bg-muted" aria-hidden />
        <div className="min-w-0 flex-1 space-y-2 text-sm">
          <p className="font-semibold">
            {SNS_ACCOUNTS.x.name} <span className="font-normal text-muted-foreground">{SNS_ACCOUNTS.x.handle}</span>
          </p>
          <p className="whitespace-pre-line" lang="ja">
            {text}
          </p>
          <HashtagChips tags={hashtags} />
          {image && <ImageSlot image={image.image} />}
          <p className={`text-right text-xs ${length > X_CHAR_LIMIT ? "text-destructive" : length > X_CHAR_RECOMMENDED ? "text-risk-medium" : "text-muted-foreground"}`}>
            {length}/{X_CHAR_LIMIT}자 (권장 {X_CHAR_RECOMMENDED}자 이내)
          </p>
          {hashtags.length > X_MAX_HASHTAGS && <p className="text-xs text-risk-medium">해시태그가 {X_MAX_HASHTAGS}개를 넘으면 노출이 줄어요</p>}
          <p className="text-xs text-muted-foreground">외부 링크는 본문이 아니라 첫 답글에 달아요</p>
          <p className="whitespace-pre-line border-t pt-2 text-xs text-muted-foreground">{post ? fill(post.options[0].text_ko) : ""}</p>
        </div>
      </div>
    </div>
  );
}

function BannerPreview({ blocks, fill }: { blocks: GuideBlock[]; fill: Fill }) {
  const copy = blocks.find((b) => b.key === "copy");
  const sub = blocks.find((b) => b.key === "sub");
  return (
    <div className="space-y-2">
      <div className="flex aspect-[3/1] items-center gap-4 rounded-md border p-4">
        <div className="flex-1">
          <p className="text-xl font-semibold" lang="ja">
            {copy ? fill(copy.options[0].text_ja) : ""}
          </p>
          <p className="mt-1 text-sm" lang="ja">
            {sub ? fill(sub.options[0].text_ja) : ""}
          </p>
        </div>
        <ImageSlot image={copy?.image} className="h-full w-2/5" />
      </div>
      <p className="text-xs text-muted-foreground">
        {copy ? fill(copy.options[0].text_ko) : ""} · {sub ? fill(sub.options[0].text_ko) : ""}
      </p>
    </div>
  );
}

/** SNS 가이드(보고서)를 바탕으로 정한 채널 운영 기준 */
const CHANNEL_RULES: Partial<Record<GuideChannel, string[]>> = {
  instagram: [
    "역할: 신뢰·학습 (왜 사야 하는가를 설득)",
    "캡션 8~15줄, 더보기 전 첫 2줄에 핵심",
    "첫 줄 스타일: 마침표 1줄 선언형(기본) · 【NEW】【お知らせ】(공지) · [ ] 또는 | |(매거진풍) · 감성 스토리텔링 문장. ＼〜／는 쓰지 않아요",
    "말투는 친근하게(〜してね), 이모지 4~8개를 톤에 맞게 (수분 💧🫧 · 계절 ❄️🌸). 상세페이지는 진지한 톤",
    "해시태그 5개 (브랜드 1 · 성분·제형 1 · 고민·트렌드 2 · 검색어 1)",
    "사진 4:5 세로, 1~5장 (제품 35% · 제형 30% · 피부 25%)",
    "링크는 프로필 링크로, 약기법 각주(*浸透：角質層まで 등) 필수",
    "올리는 시간: 점심 11:45~12:45, 저녁 19:30~21:30 (일본 시간)",
  ],
  x: [
    "역할: 속도·확산 (지금 알리기)",
    "3~4줄, 100~130자",
    "첫 줄 스타일: 마침표 1줄 선언형 · 【NEW】【特報】(공지). ＼〜／는 쓰지 않아요",
    "말투는 친근하게, 이모지 1~2개",
    "해시태그 1~3개 (브랜드 1 + 캠페인·제품 1)",
    "이미지 16:9 1장, 외부 링크는 첫 답글",
    "각주가 필요한 표현(浸透 등)은 피하고 짧게",
    "올리는 시간: 점심 11:45~12:45, 저녁 19:30~21:30 (일본 시간)",
  ],
};

export function ContentGuide({ products, drafts, materials, author }: ContentGuideProps) {
  const [productId, setProductId] = useState(products[0].id);
  const [channel, setChannel] = useState<GuideChannel>("qoo10_detail");
  const [postType, setPostType] = useState<PostType>("general");
  const [slideCount, setSlideCount] = useState(IG_MAX_SLIDES);
  // 생성 흐름: 제작하기 → 제목 3개 → 제목 고르기 → 본문·미리보기
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [loading, setLoading] = useState<"titles" | "body" | null>(null);
  /** "제목 id:블록 key" → 메모 (화면에만 둔다) */
  const [memos, setMemos] = useState<Record<string, string>>({});
  /** PDF 뒤에 촬영 가이드(붙임 1쪽)를 붙일지 */
  const [withPhotoGuide, setWithPhotoGuide] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const product = products.find((p) => p.id === productId) ?? products[0];
  const material = materials[product.id] ?? { hasReviews: false, appeals: [], keywords: [] };
  const hasPostType = channel === "instagram" || channel === "x";
  // 가장 추천을 맨 앞에 둔다
  const list = drafts
    .filter((d) => d.channel === channel && (!hasPostType || d.post_type === postType))
    .toSorted((a, b) => Number(b.recommended) - Number(a.recommended));
  // 제품·채널·게시물 종류가 바뀌면 다시 제작해야 한다
  const genKey = `${productId}|${channel}|${hasPostType ? postType : "-"}`;
  const generated = generatedKey === genKey;
  const current = generated ? list.find((d) => d.id === pickedId) : undefined;
  const blocks = (current?.blocks ?? []).filter(
    (b) =>
      // 리뷰가 없는 제품(개발 중)은 리뷰 블록을 뺀다
      (!b.needs_reviews || material.hasReviews) &&
      // 인스타그램은 고른 장 수까지만 (1장 = 단일 게시물, 2~5장 = 여러 장)
      (channel !== "instagram" || !b.key.startsWith("slide") || Number(b.key.slice(5)) <= slideCount),
  );
  const fill = (text: string) => fillProduct(text, product.name_ko, product.ingredients);
  // 개발 중 제품은 상세페이지를 아직 만들지 않는다
  const detailBlocked = channel === "qoo10_detail" && product.launch_status === "developing";

  // 해시태그: 인스타그램은 시장 분석 검색어 상위 태그를 고민·트렌드에 덧붙인다 (X는 1~3개라 덧붙이지 않는다)
  const keywordTags = channel === "instagram" ? material.keywords.slice(0, KEYWORD_TAGS).map(keywordToHashtag) : [];
  // 인스타그램은 5개: 브랜드 1 + 성분·제형 1 + 고민·트렌드 2 + 검색어 1
  const groups: Hashtags = !current
    ? { brand: [], ingredient: [], trend: [] }
    : channel === "instagram"
      ? {
          brand: current.hashtags.brand.slice(0, 1),
          ingredient: current.hashtags.ingredient.slice(0, 1),
          trend: [...new Set([...current.hashtags.trend.slice(0, IG_HASHTAG_LIMIT - 2 - KEYWORD_TAGS), ...keywordTags])],
        }
      : current.hashtags;
  const hashtags = [...groups.brand, ...groups.ingredient, ...groups.trend];
  const category = product.line.includes("에센스") ? "美容液" : "化粧水";

  /** AI 연결 전: 잠깐 기다렸다가 샘플을 보여 준다 */
  function wait(step: "titles" | "body", done: () => void) {
    clearTimeout(timer.current);
    setLoading(step);
    timer.current = setTimeout(() => {
      setLoading(null);
      done();
    }, SAMPLE_DELAY_MS);
  }
  function generate() {
    const key = genKey;
    setPickedId(null);
    setMemos({});
    wait("titles", () => setGeneratedKey(key));
  }
  function pick(id: string) {
    if (id !== pickedId) wait("body", () => setPickedId(id));
  }

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
                onClick={() => setChannel(ch.id)}
                className={`rounded-full border px-3 py-1 text-sm ${channel === ch.id ? "border-foreground bg-muted font-medium" : "text-muted-foreground hover:bg-muted"}`}
              >
                {ch.label}
              </button>
            ))}
          </div>
          {hasPostType && (
            <div className="flex flex-wrap gap-4">
              <div className="w-56">
                <label htmlFor="guide-post-type" className={LABEL}>
                  게시물 종류
                </label>
                <select
                  id="guide-post-type"
                  className={SELECT}
                  value={postType}
                  onChange={(e) => setPostType(POST_TYPES.find((t) => t.id === e.target.value)?.id ?? "general")}
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
          {CHANNEL_RULES[channel] && (
            <details className="rounded-md border p-3 text-sm">
              <summary className="cursor-pointer font-medium">채널 운영 기준 (SNS 가이드 분석)</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                {CHANNEL_RULES[channel].map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="text-xs text-muted-foreground">샘플 데이터 · AI 연결 전</span>
            <Button type="button" onClick={generate} disabled={detailBlocked || loading !== null}>
              {generated ? "다시 제작하기" : "제작하기"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {detailBlocked ? (
        <EmptyState message="개발 중인 제품은 아직 상세페이지를 만들지 않아요" action="출시된 스킨·에센스를 고르거나 다른 채널을 골라 주세요" />
      ) : loading === "titles" ? (
        <LoadingState step="1/2 · 리뷰 소구점과 검색어를 반영해 제목 3개를 만드는 중…" />
      ) : !generated ? (
        <EmptyState message="「제작하기」를 누르면 제목 3개를 추천해요" action="제목을 고르면 그 제목으로 미리보기와 본문을 만들어요" />
      ) : list.length === 0 ? (
        <EmptyState message="이 조합의 샘플 문구가 아직 없어요" action="다른 채널이나 게시물 종류를 골라 보세요" />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>1. 제목 고르기</CardTitle>
              </CardHeader>
              <CardContent className={`${PANEL_HEIGHT} overflow-y-auto`}>
                <ol className="space-y-2">
                  {list.map((d, i) => {
                    const selected = d.id === pickedId;
                    return (
                      <li key={d.id}>
                        <button
                          type="button"
                          aria-pressed={selected}
                          disabled={loading !== null}
                          onClick={() => pick(d.id)}
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
                <CardTitle>2. 미리보기</CardTitle>
              </CardHeader>
              <CardContent className={`${PANEL_HEIGHT} overflow-y-auto`} role="region" aria-label="결과물 미리보기" tabIndex={0}>
                {loading === "body" ? (
                  <LoadingState step="2/2 · 고른 제목으로 미리보기와 본문을 만드는 중…" />
                ) : !current ? (
                  <EmptyState message="왼쪽에서 제목을 골라 주세요" action="고른 제목으로 미리보기와 본문을 만들어요" />
                ) : (
                  <>
                    {channel === "qoo10_detail" && <Qoo10Preview blocks={blocks} gallery={current.gallery} fill={fill} productName={product.name_ko} category={category} />}
                    {channel === "instagram" && <InstagramPreview key={`${current.id}-${slideCount}`} blocks={blocks} hashtags={hashtags} fill={fill} />}
                    {channel === "x" && <XPreview blocks={blocks} hashtags={hashtags} fill={fill} />}
                    {channel === "banner" && <BannerPreview blocks={blocks} fill={fill} />}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {current && loading === null && (
            <Card>
              <CardHeader>
                <CardTitle>3. 본문 추천 · 메모</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {channel === "qoo10_detail" && <GalleryGuide gallery={current.gallery} />}
                <BodyPager
                  key={`${current.id}-${slideCount}`}
                  blocks={blocks}
                  fill={fill}
                  memos={Object.fromEntries(blocks.map((b) => [b.key, memos[`${current.id}:${b.key}`] ?? ""]))}
                  onMemo={(blockKey, text) => setMemos((m) => ({ ...m, [`${current.id}:${blockKey}`]: text }))}
                  memoWhere={(blockKey) => memoLocation(channel, blocks, blockKey)}
                />

                <details className="rounded-md border p-3">
                  <summary className="cursor-pointer font-semibold">촬영 가이드 (컷 리스트 {buildCutList(channel, blocks, current.gallery).length}컷 · PDF 붙임)</summary>
                  <div className="mt-2 grid gap-3 text-xs sm:grid-cols-2">
                    <div>
                      <p className="font-medium">공통 규칙</p>
                      <ul className="list-disc pl-5 text-muted-foreground">
                        {PHOTO_RULES.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium">찍으면 안 되는 것</p>
                      <ul className="list-disc pl-5 text-muted-foreground">
                        {PHOTO_DONTS.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">컷 리스트는 사진 칸 설명을 모아 만들어요 (AI를 따로 부르지 않아요).</p>
                </details>

                {hasPostType && hashtags.length > 0 && (
                  <section className="space-y-3 rounded-md border p-3">
                    <h3 className="font-semibold">
                      해시태그 추천 ({hashtags.length}개 · 기준 {channel === "x" ? `1~${X_MAX_HASHTAGS}` : IG_HASHTAG_LIMIT}개)
                    </h3>
                    {HASHTAG_GROUPS.filter((g) => groups[g.key].length > 0).map((g) => (
                      <div key={g.key} className="space-y-1">
                        <p className="text-xs font-medium">{g.label}</p>
                        <HashtagChips tags={groups[g.key]} />
                        <p className="text-xs text-muted-foreground">{g.reason}</p>
                      </div>
                    ))}
                    {keywordTags.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        검색어에서 뽑은 태그: {keywordTags.join(" ")} (시장 분석 검색어 1위)
                      </p>
                    )}
                    {channel === "x" && <p className="text-xs text-muted-foreground">X는 해시태그가 3개를 넘으면 노출이 줄어서 브랜드 1개 + 캠페인·제품 1개만 써요.</p>}
                  </section>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-muted-foreground">
          {current ? "고른 제목·메모가 들어가요. 인쇄 창에서 「PDF로 저장」을 고르세요" : "제목을 고르면 PDF로 출력할 수 있어요"}
        </span>
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={withPhotoGuide} onChange={(e) => setWithPhotoGuide(e.target.checked)} />
          촬영 가이드 붙이기
        </label>
        <Button type="button" disabled={!current || loading !== null} onClick={() => window.print()}>
          PDF 출력
        </Button>
      </div>

      {current && (
        <ContentGuideReport
          channel={channel}
          productName={product.name_ko}
          channelLabel={GUIDE_CHANNELS.find((c) => c.id === channel)?.label ?? channel}
          postTypeLabel={hasPostType ? (POST_TYPES.find((t) => t.id === postType)?.label ?? null) : null}
          author={author}
          title={{ ja: current.title_ja, ko: current.title_ko, reason: current.reason }}
          appeals={material.hasReviews ? material.appeals : []}
          keywords={material.keywords}
          blocks={blocks}
          gallery={channel === "qoo10_detail" ? current.gallery : []}
          hashtags={hasPostType ? hashtags : []}
          memos={Object.fromEntries(blocks.map((b) => [b.key, memos[`${current.id}:${b.key}`] ?? ""]))}
          fill={fill}
          cutList={withPhotoGuide ? buildCutList(channel, blocks, current.gallery) : null}
        />
      )}
    </div>
  );
}
