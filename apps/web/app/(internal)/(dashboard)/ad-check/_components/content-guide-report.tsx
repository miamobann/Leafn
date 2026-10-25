// 콘텐츠 제작 가이드의 PDF 보고서 (브라우저 인쇄 → 「PDF로 저장」).
// 화면에는 숨겨 두고 인쇄할 때만 보인다. A4 가로 · 두괄식(1쪽 개요·요약 먼저) · 고른 제목의 최종안 + 블록 메모.
// 디자이너에게 전달하는 문서라 장면(사진 칸)을 옆으로 나란히 두고, 사진 설명은 사진 칸 안에 적는다.
// 읽기 편하게: 테두리 상자를 줄이고(회색 면으로 구분), 섹션 사이 여백을 넉넉히, 회색 글씨는 번역·보조 설명에만.
import type { ReactNode } from "react";
import { SNS_ACCOUNTS, type GalleryShot, type GuideBlock } from "../_lib/content-guide-samples";
import { PHOTO_DONTS, PHOTO_RULES, type CutRow } from "../_lib/photo-guide";
import { AD_DISCLAIMER_TEXT } from "./ad-disclaimer";

export type ReportAuthor = { name: string; team: string };

type Channel = "qoo10_detail" | "instagram" | "x" | "banner";

type ContentGuideReportProps = {
  productName: string;
  channelLabel: string;
  /** SNS만 */
  postTypeLabel: string | null;
  author: ReportAuthor;
  title: { ja: string; ko: string; reason: string };
  appeals: string[];
  keywords: string[];
  blocks: GuideBlock[];
  /** 상세페이지(큐텐)만: 대표 이미지 */
  gallery: GalleryShot[];
  hashtags: string[];
  /** 블록 key → 메모 */
  memos: Record<string, string>;
  fill: (text: string) => string;
  channel: Channel;
  /** 붙임: 촬영 가이드 (없으면 붙이지 않는다) */
  cutList: CutRow[] | null;
  /** 제작할 때 반영한 강조할 방향 (없으면 빈 문자열) */
  direction: string;
};

type Fill = ContentGuideReportProps["fill"];

const PURPOSE: Record<Channel, { purpose: string; scope: string }> = {
  qoo10_detail: { purpose: "큐텐 상세페이지 제작안 보고 및 디자인 전달", scope: "대표 이미지 · 상세페이지 장면 · 촬영 가이드" },
  instagram: { purpose: "인스타그램 게시물 제작안 보고 및 디자인 전달", scope: "슬라이드 · 캡션 · 해시태그 · 촬영 가이드" },
  x: { purpose: "X 게시물 제작안 보고 및 디자인 전달", scope: "게시글 · 이미지 · 해시태그 · 촬영 가이드" },
  banner: { purpose: "배너 제작안 보고 및 디자인 전달", scope: "메인·서브 카피 · 배너 이미지 · 촬영 가이드" },
};

const pad = (n: number) => String(n).padStart(2, "0");

/** 블록 메모가 PDF 어디에 적히는지 (화면의 메모 칸 아래에 안내한다) */
export function memoLocation(channel: Channel, blocks: GuideBlock[], blockKey: string): string {
  const index = blocks.findIndex((b) => b.key === blockKey);
  if (channel === "qoo10_detail") return `4. 상세페이지 스토리보드 · ${pad(index + 1)}장 아래`;
  if (channel === "instagram") return blockKey === "caption" ? "4. 해시태그 · 검토 메모" : `2. 슬라이드 · ${blockKey.replace("slide", "")}장 아래`;
  return channel === "x" ? "3. 해시태그 · 검토 메모" : "3. 카피 안 · 검토 메모";
}

/** 스토리보드 한 쪽에 넣는 장면 수 (3열 × 2줄) */
const SCENES_PER_PAGE = 6;

// 대시보드 레이아웃(사이드바·헤더)은 공용 영역이라 고치지 않고, 인쇄할 때만 보고서 밖을 숨긴다.
// 보고서를 감싼 요소는 남기되 높이·스크롤 제한을 풀어 여러 쪽으로 이어지게 한다.
// 글꼴은 앱과 같은 Noto Sans KR(보고서용 고딕), 없으면 맑은 고딕 · 일본어는 Noto Sans JP → Yu Gothic.
const PRINT_CSS = `
@page { size: A4 landscape; margin: 10mm; }
@media print {
  body *:not(:has(#guide-report)):not(#guide-report):not(#guide-report *) { display: none !important; }
  *:has(#guide-report) { display: block !important; position: static !important; overflow: visible !important; height: auto !important; min-height: 0 !important; max-height: none !important; margin: 0 !important; padding: 0 !important; border: 0 !important; box-shadow: none !important; }
  #guide-report { font-family: var(--font-noto-kr), "Noto Sans KR", "Malgun Gothic", "맑은 고딕", "Apple SD Gothic Neo", "Noto Sans JP", "Yu Gothic", "Hiragino Sans", sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

const ja = (b: GuideBlock | undefined, fill: Fill) => (b ? fill(b.options[0]?.text_ja ?? "") : "");
const ko = (b: GuideBlock | undefined, fill: Fill) => (b ? fill(b.options[0]?.text_ko ?? "") : "");

/* ───────── 쪽 틀 ───────── */

/** 한 쪽. 인쇄 영역 높이(A4 가로 210mm − 위아래 여백 20mm)를 채워 바닥글을 쪽 맨 아래에 고정한다 */
function Page({ children, page, total, props }: { children: ReactNode; page: number; total: number; props: ContentGuideReportProps }) {
  return (
    <section className={`flex h-[189mm] flex-col gap-4 overflow-hidden text-[10pt] leading-relaxed ${page === 1 ? "" : "break-before-page"}`}>
      {page > 1 && (
        <header className="flex items-baseline justify-between border-b pb-1 text-[8.5pt] text-muted-foreground">
          <span>콘텐츠 제작 보고서</span>
          <span>
            {props.productName} · {props.channelLabel}
            {props.postTypeLabel ? ` · ${props.postTypeLabel}` : ""}
          </span>
        </header>
      )}
      {children}
      <footer className="mt-auto flex justify-between border-t pt-1 text-[8pt] text-muted-foreground">
        <span>{AD_DISCLAIMER_TEXT} · 샘플 데이터 (AI 미연결 · 모델·프롬프트 버전은 AI 연결 후 표시)</span>
        <span>
          {page} / {total}
        </span>
      </footer>
    </section>
  );
}

/** 섹션 제목: 번호 동그라미 + 제목 + 아래 선 */
function SectionTitle({ n, children }: { n: number | string; children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 border-b border-foreground pb-1 text-[13pt] font-bold">
      <span className="flex size-6 items-center justify-center rounded-full bg-foreground text-[9pt] text-background">{n}</span>
      {children}
    </h2>
  );
}

function Section({ n, title, children, className = "" }: { n: number | string; title: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`space-y-2 ${className}`}>
      <SectionTitle n={n}>{title}</SectionTitle>
      {children}
    </section>
  );
}

/** 1쪽 맨 위: 보고서 제목 + 개요 표 (회사 보고서 형식) */
function Overview({ props }: { props: ContentGuideReportProps }) {
  const today = new Date().toISOString().slice(0, 10);
  const th = "w-20 bg-muted px-3 py-1.5 text-left font-medium";
  const td = "px-3 py-1.5";
  return (
    <header className="space-y-3">
      <p className="text-[18pt] font-bold tracking-tight">콘텐츠 제작 보고서</p>
      <table className="w-full border-collapse border-y-2 border-foreground text-[9.5pt]">
        <tbody className="divide-y">
          <tr>
            <th className={th}>제품</th>
            <td className={td}>{props.productName}</td>
            <th className={th}>채널</th>
            <td className={td}>
              {props.channelLabel}
              {props.postTypeLabel ? ` · ${props.postTypeLabel}` : ""}
            </td>
            <th className={th}>작성자</th>
            <td className={td}>
              {props.author.name} · {props.author.team}
            </td>
            <th className={th}>작성일</th>
            <td className={td}>{today}</td>
          </tr>
          <tr>
            <th className={th}>목적</th>
            <td className={td} colSpan={3}>
              {PURPOSE[props.channel].purpose}
            </td>
            <th className={th}>범위</th>
            <td className={td} colSpan={3}>
              {PURPOSE[props.channel].scope}
              {props.cutList ? "" : " (촬영 가이드 제외)"}
            </td>
          </tr>
        </tbody>
      </table>
    </header>
  );
}

/** 1. 요약 (두괄식): 무엇을(제목) · 왜(추천 이유) · 근거(재료) + 검토 요청 사항 */
function Summary({ props }: { props: ContentGuideReportProps }) {
  const evidence = props.blocks.filter((b) => b.needs_evidence).length;
  const memoCount = props.blocks.filter((b) => props.memos[b.key]?.trim()).length;
  return (
    <Section n={1} title="요약">
      <div className="grid grid-cols-[2fr_1fr] gap-6">
        <div className="space-y-2">
          <div>
            <p className="text-[15pt] font-bold" lang="ja">
              {props.title.ja}
            </p>
            <p className="text-muted-foreground">{props.title.ko}</p>
          </div>
          <dl className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1">
            <dt className="font-medium">추천 이유</dt>
            <dd>{props.title.reason}</dd>
            <dt className="font-medium">리뷰 소구점</dt>
            <dd>{props.appeals.slice(0, 3).join(" · ") || "없음 (리뷰 없음)"}</dd>
            <dt className="font-medium">검색어</dt>
            <dd lang="ja">{props.keywords.slice(0, 3).join(" · ") || "없음"}</dd>
            {props.direction && (
              <>
                <dt className="font-medium">강조한 방향</dt>
                <dd>{props.direction}</dd>
              </>
            )}
          </dl>
        </div>
        <div className="space-y-1 rounded-md bg-muted p-3">
          <p className="font-bold">검토 요청 사항</p>
          <ul className="list-disc space-y-0.5 pl-4">
            <li>약기법 판정: AI 연결 후 표시</li>
            <li>근거가 있어야 채울 칸: {evidence}개</li>
            <li>검토 메모: {memoCount}건</li>
          </ul>
        </div>
      </div>
    </Section>
  );
}

/** 사진 칸: 회색 면 안에 번호 · 장면 이름 · 촬영 지시를 적는다 */
function PhotoBox({ no, label, image, className }: { no: number; label?: string; image: string | null; className: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-1 rounded-md bg-muted p-3 text-center ${className}`}>
      <p className="text-[8.5pt] font-bold tracking-wider">
        PHOTO {pad(no)}
        {label ? ` · ${label}` : ""}
      </p>
      <p className="text-[9pt] text-foreground/70">{image ?? "사진 없음 (글만)"}</p>
    </div>
  );
}

function MemoLine({ text }: { text?: string }) {
  if (!text?.trim()) return null;
  return (
    <p className="whitespace-pre-line border-l-2 border-foreground pl-2 text-[9pt]">
      <span className="font-bold">메모</span> {text}
    </p>
  );
}

/** 해시태그 · 검토 메모 (SNS·배너) */
function NotesSection({ n, title, props, showHashtags }: { n: number; title: string; props: ContentGuideReportProps; showHashtags: boolean }) {
  const written = props.blocks.map((b, i) => ({ b, i })).filter(({ b }) => props.memos[b.key]?.trim());
  return (
    <Section n={n} title={title}>
      <div className="grid grid-cols-2 gap-6">
        {showHashtags ? (
          <div className="space-y-1">
            <p className="font-bold">해시태그 ({props.hashtags.length}개)</p>
            <p lang="ja" className="flex flex-wrap gap-x-3 gap-y-1">
              {props.hashtags.map((t) => (
                <span key={t} className="whitespace-nowrap rounded bg-muted px-2">
                  {t}
                </span>
              ))}
            </p>
          </div>
        ) : (
          <CopyOptions props={props} />
        )}
        <div className="space-y-1">
          <p className="font-bold">검토 메모</p>
          {written.length === 0 ? (
            <p className="text-muted-foreground">메모 없음</p>
          ) : (
            <ul className="space-y-1">
              {written.map(({ b, i }) => (
                <li key={b.key} className="whitespace-pre-line border-l-2 border-foreground pl-2">
                  <span className="font-medium">
                    {i + 1}. {b.heading}
                  </span>{" "}
                  {props.memos[b.key]}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Section>
  );
}

/* ───────── 상세페이지(큐텐) ───────── */

function FlowSection({ props }: { props: ContentGuideReportProps }) {
  const { blocks, fill } = props;
  return (
    <Section n={2} title={`전체 흐름 (${blocks.length}장)`}>
      <ol className="grid grid-cols-6 gap-3">
        {blocks.map((b, i) => (
          <li key={b.key} className={`rounded-md p-2 ${b.needs_evidence ? "border border-dashed text-muted-foreground" : "bg-muted"}`}>
            <p className="text-[8.5pt] font-bold">{pad(i + 1)}</p>
            <p className="font-medium">{b.heading}</p>
            <p className="truncate text-[8.5pt] text-muted-foreground" lang="ja">
              {b.needs_evidence ? "근거 있을 때만" : ja(b, fill)}
            </p>
          </li>
        ))}
      </ol>
      <p className="text-[8.5pt] text-muted-foreground">대표 이미지는 3번, 장면별 사진·문구·메모는 4번 스토리보드에 있어요. 디자인할 때 장면을 나누거나 더해도 됩니다.</p>
    </Section>
  );
}

/** 큐텐 대표 이미지 (정사각형). 첫 장(검색 썸네일)은 자세히, 나머지는 역할만 */
function GallerySection({ gallery }: { gallery: GalleryShot[] }) {
  const [first, ...rest] = gallery;
  if (!first) return null;
  return (
    <Section n={3} title={`대표 이미지 (정사각형 1:1 · ${gallery.length}장)`}>
      <p className="text-[9pt] text-muted-foreground">상품 페이지 맨 위에서 옆으로 넘기는 사진이에요. 첫 장은 검색 결과 목록의 썸네일로 쓰여요.</p>
      <div className="grid grid-cols-[60mm_1fr] gap-6">
        <PhotoBox no={1} label={first.role} image={first.image} className="aspect-square" />
        <div className="space-y-2">
          <p className="font-bold">첫 장(검색 썸네일) 규칙</p>
          <ul className="list-disc space-y-1 pl-4">
            {first.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {rest.map((g, i) => (
          <PhotoBox key={g.role} no={i + 2} label={g.role} image={g.image} className="h-[30mm]" />
        ))}
      </div>
    </Section>
  );
}

/** 스토리보드 한 장면: 사진 칸 + 바로 아래 문구 (일본어 · 한국어) + 메모 */
function Scene({ block, no, fill, memo }: { block: GuideBlock; no: number; fill: Fill; memo?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-bold">
        {pad(no)} · {block.heading}
      </p>
      {block.needs_evidence ? (
        <div className="flex h-[30mm] flex-col items-center justify-center rounded-md border border-dashed p-3 text-center text-[9pt] text-muted-foreground">
          <p className="font-medium">근거 자료가 있을 때만 넣는 칸</p>
          <p>{ko(block, fill)}</p>
        </div>
      ) : (
        <>
          <PhotoBox no={no} image={block.image} className="h-[30mm]" />
          <p className="whitespace-pre-line font-medium" lang="ja">
            {ja(block, fill)}
          </p>
          <p className="whitespace-pre-line text-[9pt] text-muted-foreground">{ko(block, fill)}</p>
        </>
      )}
      <MemoLine text={memo} />
    </div>
  );
}

function detailPages(props: ContentGuideReportProps): ReactNode[] {
  const { blocks, fill, memos } = props;
  const groups: GuideBlock[][] = [];
  for (let i = 0; i < blocks.length; i += SCENES_PER_PAGE) groups.push(blocks.slice(i, i + SCENES_PER_PAGE));
  return [
    <>
      <Overview props={props} />
      <Summary props={props} />
      <FlowSection props={props} />
    </>,
    ...(props.gallery.length > 0 ? [<GallerySection key="gallery" gallery={props.gallery} />] : []),
    ...groups.map((group, p) => (
      <Section key={p} n={4} title={`상세페이지 스토리보드 (${p * SCENES_PER_PAGE + 1}~${p * SCENES_PER_PAGE + group.length}장)`}>
        <div className="grid grid-cols-3 gap-x-6 gap-y-5">
          {group.map((b, i) => (
            <Scene key={b.key} block={b} no={p * SCENES_PER_PAGE + i + 1} fill={fill} memo={memos[b.key]} />
          ))}
        </div>
      </Section>
    )),
  ];
}

/* ───────── SNS · 배너 ───────── */

function instagramPages(props: ContentGuideReportProps): ReactNode[] {
  const { blocks, fill, memos } = props;
  const slides = blocks.filter((b) => b.key.startsWith("slide"));
  const caption = blocks.find((b) => b.key === "caption");
  return [
    <>
      <Overview props={props} />
      <Summary props={props} />
      <Section n={2} title={`슬라이드 (${slides.length}장 · 4:5) · ${SNS_ACCOUNTS.instagram.handle}`}>
        <div className="grid grid-cols-5 gap-4 [overflow-wrap:anywhere]">
          {slides.map((b, i) => (
            <div key={b.key} className="flex flex-col gap-1.5">
              <PhotoBox no={i + 1} label={b.heading.replace(/^슬라이드 \d+ · /, "")} image={b.image} className="h-[34mm]" />
              <p className="whitespace-pre-line font-medium" lang="ja">
                {ja(b, fill)}
              </p>
              <p className="whitespace-pre-line text-[9pt] text-muted-foreground">{ko(b, fill)}</p>
              <MemoLine text={memos[b.key]} />
            </div>
          ))}
        </div>
      </Section>
    </>,
    <>
      <Section n={3} title="캡션">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-1">
            <p className="text-[9pt] font-bold text-muted-foreground">일본어 (게시용)</p>
            <p className="whitespace-pre-line" lang="ja">
              {ja(caption, fill)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[9pt] font-bold text-muted-foreground">한국어 (확인용)</p>
            <p className="whitespace-pre-line text-foreground/80">{ko(caption, fill)}</p>
          </div>
        </div>
      </Section>
      <NotesSection n={4} title="해시태그 · 검토 메모" props={props} showHashtags />
    </>,
  ];
}

function xPages(props: ContentGuideReportProps): ReactNode[] {
  const { blocks, fill } = props;
  const post = blocks.find((b) => b.key === "post");
  const image = blocks.find((b) => b.key === "image");
  const text = ja(post, fill);
  const length = [...[text, props.hashtags.join(" ")].join("\n").trim()].length;
  return [
    <>
      <Overview props={props} />
      <Summary props={props} />
      <Section n={2} title={`게시글 · ${SNS_ACCOUNTS.x.name} ${SNS_ACCOUNTS.x.handle}`}>
        <div className="grid grid-cols-3 gap-6">
          <div className="space-y-1">
            <p className="text-[9pt] font-bold text-muted-foreground">일본어 (게시용)</p>
            <p className="whitespace-pre-line font-medium" lang="ja">
              {text}
            </p>
            <p className="text-[8.5pt] text-muted-foreground">{length}자 (권장 130자 이내) · 링크는 첫 답글</p>
          </div>
          <div className="space-y-1">
            <p className="text-[9pt] font-bold text-muted-foreground">한국어 (확인용)</p>
            <p className="whitespace-pre-line text-foreground/80">{ko(post, fill)}</p>
          </div>
          <PhotoBox no={1} label="이미지 16:9" image={image?.image ?? null} className="h-[36mm]" />
        </div>
      </Section>
      <NotesSection n={3} title="해시태그 · 검토 메모" props={props} showHashtags />
    </>,
  ];
}

function CopyOptions({ props }: { props: ContentGuideReportProps }) {
  const copy = props.blocks.find((b) => b.key === "copy");
  return (
    <div className="space-y-1">
      <p className="font-bold">카피 안</p>
      <ul className="space-y-1">
        {copy?.options.map((o, i) => (
          <li key={o.text_ja}>
            <span lang="ja" className="font-medium">
              {i === 0 ? "추천" : "다른 안"} · {props.fill(o.text_ja)}
            </span>
            <span className="block text-[9pt] text-muted-foreground">{props.fill(o.text_ko)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function bannerPages(props: ContentGuideReportProps): ReactNode[] {
  const { blocks, fill } = props;
  const copy = blocks.find((b) => b.key === "copy");
  const sub = blocks.find((b) => b.key === "sub");
  return [
    <>
      <Overview props={props} />
      <Summary props={props} />
      <Section n={2} title="배너 (가로형)">
        <div className="flex h-[32mm] items-center gap-6 rounded-md border p-4" lang="ja">
          <div className="flex-1 space-y-1">
            <p className="text-[20pt] font-bold">{ja(copy, fill)}</p>
            <p className="text-muted-foreground">{ja(sub, fill)}</p>
          </div>
          <PhotoBox no={1} label="배경·제품" image={copy?.image ?? null} className="h-full w-2/5" />
        </div>
      </Section>
      <NotesSection n={3} title="카피 안 · 검토 메모" props={props} showHashtags={false} />
    </>,
  ];
}

/* ───────── 붙임 ───────── */

/** 붙임: 촬영 가이드. 정해진 규칙 + 결과물의 사진 칸 설명을 모은 컷 리스트 (AI를 따로 부르지 않는다) */
function PhotoGuide({ cutList }: { cutList: CutRow[] }) {
  return (
    <Section n="붙" title="촬영 가이드">
      <div className="grid grid-cols-[3fr_2fr] gap-6">
        <div className="space-y-1">
          <p className="font-bold">컷 리스트 ({cutList.length}컷)</p>
          <table className="w-full border-collapse border-t-2 border-foreground text-[8.5pt] leading-snug">
            <thead>
              <tr className="border-b bg-muted text-left">
                <th className="w-10 px-2 py-1">번호</th>
                <th className="w-48 px-2">용도</th>
                <th className="w-28 px-2">비율</th>
                <th className="px-2">촬영 지시</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cutList.map((r) => (
                <tr key={r.no} className="align-top">
                  <td className="px-2 py-0.5">{pad(r.no)}</td>
                  <td className="px-2 py-0.5">{r.use}</td>
                  <td className="px-2 py-0.5">{r.ratio}</td>
                  <td className="px-2 py-0.5">{r.image}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="font-bold">공통 규칙</p>
            <ul className="list-disc space-y-1 pl-4">
              {PHOTO_RULES.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-1 rounded-md bg-muted p-3">
            <p className="font-bold">찍으면 안 되는 것</p>
            <ul className="list-disc space-y-1 pl-4">
              {PHOTO_DONTS.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Section>
  );
}

const PAGES: Record<Channel, (props: ContentGuideReportProps) => ReactNode[]> = {
  qoo10_detail: detailPages,
  instagram: instagramPages,
  x: xPages,
  banner: bannerPages,
};

export function ContentGuideReport(props: ContentGuideReportProps) {
  const pages = [...PAGES[props.channel](props), ...(props.cutList ? [<PhotoGuide key="photo" cutList={props.cutList} />] : [])];
  return (
    <div id="guide-report" className="hidden bg-background text-foreground print:block">
      <style>{PRINT_CSS}</style>
      {pages.map((content, i) => (
        <Page key={i} page={i + 1} total={pages.length} props={props}>
          {content}
        </Page>
      ))}
    </div>
  );
}
