"use client";

import { useState } from "react";
import { AiResultMeta } from "@/components/common/ai";
import { LangBadge } from "@/components/common/badges";
import { EvidenceSheet } from "@/components/common/evidence-sheet";
import { EmptyState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { GEO_ENGINE_LABEL, type GeoSnap } from "@/lib/schemas/geo";
import { SNS_PLATFORM_LABEL, SnsAnalyzeResult, type SnsPattern, type SnsPatternKind, type SnsVideoNote } from "@/lib/schemas/market";
import { parseTikTokLink } from "@/lib/external/tiktok";
import type { Product } from "@/lib/schemas/product";
import type { SearchSnap } from "@/lib/schemas/search";
import { OWN_BRAND } from "@/app/(internal)/(dashboard)/market/_lib/market";
import {
  AUTOCOMPLETE_STATUS_LABEL,
  autocompleteChanges,
  commonPatterns,
  geoMatrix,
  geoQueryKo,
  SNS_PATTERN_KIND_LABEL,
  type AutocompleteRow,
  type AutocompleteStatus,
  type AutocompleteTab,
} from "@/app/(internal)/(dashboard)/market/_lib/demand";
import { ToggleGroup } from "@/app/(internal)/(dashboard)/market/_components/toggle-group";
import { GeoInsights } from "@/app/(internal)/(dashboard)/market/_components/geo-insights";
import { SearchTrendCard } from "@/app/(internal)/(dashboard)/market/_components/search-trend";
import type { PanelContent } from "./side-panel";

// 화면 문구
const TEXT = {
  autocompleteNote: "자동완성은 검색량이 아니에요. 이번 주에 보였는지, 몇 번째였는지만 지난주와 비교해요 · おすすめ·ドラッグストア 같은 일반어는 뺐어요",
  snsBasis: "선택한 영상 기준 · 마케터가 고른 영상이라 시장 전체를 대표하지 않아요 · 고정된 샘플 결과 · 저장되지 않음",
  snsRealBasis: "등록한 실제 영상의 메모를 AI가 묶은 결과 · 근거는 메모에 그대로 있는 문구만 · 선택한 영상 기준이라 시장 전체를 대표하지 않아요 · 저장되지 않음",
  memoWhy: "TikTok 공식 공개 기능은 영상 내용(캡션·발화·댓글)을 주지 않아서, 영상을 보고 핵심 발화·자막·댓글을 메모해 주세요. AI는 메모에 적힌 내용만으로 공통 패턴을 찾아요.",
  stealth: "광고 표시가 없어도 광고가 아닌 영상이라는 보장은 없어요 (2023년 10월 시행 ステマ規制). 영상 설명·고정 댓글의 #PR·提供 표기도 확인해 주세요.",
  notReviewed: "소비자 표현은 약기법 검토 전이에요. 효능을 단정하는 말은 광고에 그대로 쓸 수 없을 수 있어요.",
  geoNote: "브랜드·키워드는 사전 대조와 원문 포함 검사로만 뽑아요. 부정문이나 다른 브랜드 이야기까지 걸러내지는 못하니 칸을 눌러 원문을 확인해 주세요.",
};

const TABS = ["피부 고민", "성분", "사전에 없는 말"] as const;
const TAB_KEY: Record<(typeof TABS)[number], AutocompleteTab> = { "피부 고민": "concern", "성분": "ingredient", "사전에 없는 말": "other" };
const STATUS_MARK: Record<AutocompleteStatus, string> = { new: "＋", up: "▲", same: "–", down: "▼", gone: "✕" };
const MIN_VIDEOS = 3;
const MAX_VIDEOS = 10;
const KIND_ORDER: SnsPatternKind[] = ["expression", "opening", "reason"];

function StatusText({ status }: { status: AutocompleteStatus }) {
  const tone = status === "new" || status === "up" ? "text-risk-low" : status === "down" || status === "gone" ? "text-risk-high" : "text-muted-foreground";
  return (
    <span className={`shrink-0 text-xs font-medium ${tone}`}>
      {STATUS_MARK[status]} {AUTOCOMPLETE_STATUS_LABEL[status]}
    </span>
  );
}

function posText(r: AutocompleteRow): string {
  const p = (n: number | null) => (n === null ? "안 보임" : `${n}번째`);
  return `지난주 ${p(r.prevPos)} → 이번 주 ${p(r.latestPos)}`;
}

// ── 2-A ─────────────────────────────────────────

function AutocompleteBlock({ search, category, onOpen }: { search: SearchSnap[]; category: string; onOpen: (c: PanelContent) => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("피부 고민");
  const data = autocompleteChanges(search, category);
  const rows = data.rows.filter((r) => r.tab === TAB_KEY[tab]);

  const open = (r: AutocompleteRow) =>
    onOpen({
      kind: "quotes",
      title: `자동완성 · ${r.term}`,
      description: `${AUTOCOMPLETE_STATUS_LABEL[r.status]} · ${posText(r)}`,
      quotes: r.evidence.map((e) => ({ ja: e.value, note: `${e.date} · 시드 「${e.seed}」 · 목록 ${e.position}번째` })),
      footnote: TEXT.autocompleteNote,
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>2-A 검색 자동완성 변화</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.seeds.length === 0 || !data.latest ? (
          <EmptyState message="이 카테고리는 자동완성을 모으지 않았어요" />
        ) : (
          <>
            <ToggleGroup label="보기" options={TABS} value={tab} onChange={setTab} />
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">이번 주와 지난주 자동완성에 해당하는 말이 없어요</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {rows.map((r) => (
                  <li key={r.key}>
                    <button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => open(r)}>
                      <span className="min-w-0">
                        <span lang="ja" className="font-medium">
                          {r.term}
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">{r.ko ?? "해석 없음 (사전에 없는 말)"}</span>
                        <span className="block text-xs text-muted-foreground">{posText(r)}</span>
                      </span>
                      <StatusText status={r.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              <LangBadge lang="ja" /> 시드 「{data.seeds.join("」「")}」 · {data.prev} → {data.latest} · {TEXT.autocompleteNote} · 누르면 자동완성 원문
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── 2-B ─────────────────────────────────────────

type VideoDraft = { key: string; url: string; memo: string };
type RunState = { status: "idle" } | { status: "running" } | { status: "done"; result: SnsAnalyzeResult } | { status: "error"; message: string };

/** 결과 카드에 쓰는 공통 모양 (샘플 결과와 AI 분석 결과를 같이 그린다) */
type PatternCard = { id: string; kind: SnsPatternKind; label_ja: string | null; label_ko: string; hits: number; open: () => void };

function PatternCards({ cards, total }: { cards: PatternCard[]; total: number }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {KIND_ORDER.map((kind) => {
        const list = cards.filter((p) => p.kind === kind);
        return (
          <div key={kind} className="rounded-lg border p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">{SNS_PATTERN_KIND_LABEL[kind]}</p>
            {list.length === 0 ? (
              <p className="text-xs text-muted-foreground">{kind === "expression" ? "공통 표현이 없어요" : "공통 패턴이 없어요"}</p>
            ) : (
              <ul className="space-y-2">
                {list.map((p) => (
                  <li key={p.id}>
                    <button type="button" className="w-full rounded-md p-1 text-left text-sm hover:bg-muted" onClick={p.open}>
                      {p.label_ja && (
                        <span lang="ja" className="block font-medium">
                          「{p.label_ja}」
                        </span>
                      )}
                      <span className={p.label_ja ? "block text-xs text-muted-foreground" : "block font-medium"}>{p.label_ko}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                        {total}개 영상 중 {p.hits}개
                        {kind === "expression" && <Badge variant="outline">… 약기법 검토 전</Badge>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SnsBlock({
  notes,
  patterns,
  imported,
  category,
  onOpen,
}: {
  notes: SnsVideoNote[];
  patterns: SnsPattern[];
  /** 이 PC의 영상 목록 (실제 링크). 있으면 샘플 대신 이것으로 시작한다 */
  imported: { category: string; url: string; memo: string }[];
  category: string;
  onOpen: (c: PanelContent) => void;
}) {
  const categoryNotes = notes.filter((n) => n.category === category);
  const realVideos = imported.filter((v) => v.category === category);
  const usingReal = realVideos.length > 0;
  // 카테고리별 편집 목록 (로컬 상태, 저장되지 않음)
  const [drafts, setDrafts] = useState<Record<string, VideoDraft[]>>({});
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [runs, setRuns] = useState<Record<string, RunState>>({});
  const videos =
    drafts[category] ??
    (usingReal ? realVideos.map((v, i) => ({ key: `real-${i}`, url: v.url, memo: v.memo })) : categoryNotes.map((n) => ({ key: n.id, url: n.url, memo: n.note_ja })));
  const setVideos = (next: VideoDraft[]) => setDrafts((d) => ({ ...d, [category]: next }));
  const run = runs[category] ?? { status: "idle" };
  const withMemo = videos.filter((v) => v.url.trim() && v.memo.trim());

  async function analyze() {
    setRuns((r) => ({ ...r, [category]: { status: "running" } }));
    try {
      const res = await fetch("/api/market/sns-patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, videos: withMemo.map((v) => ({ url: v.url.trim(), memo: v.memo.trim() })) }),
      });
      const body: unknown = await res.json();
      if (!res.ok) {
        const message = typeof body === "object" && body && "error" in body && typeof body.error === "string" ? body.error : `오류 (${res.status})`;
        return setRuns((r) => ({ ...r, [category]: { status: "error", message } }));
      }
      setRuns((r) => ({ ...r, [category]: { status: "done", result: SnsAnalyzeResult.parse(body) } }));
    } catch (e) {
      setRuns((r) => ({ ...r, [category]: { status: "error", message: e instanceof Error ? e.message : "요청 실패" } }));
    }
  }

  // 화면에 그릴 결과: AI 분석 결과 > (샘플 영상이면) 고정 샘플 결과
  let cards: PatternCard[] | null = null;
  let total = 0;
  if (run.status === "done") {
    const r = run.result;
    total = r.videos.length;
    cards = r.patterns.map((p, i) => ({
      id: `ai-${i}`,
      kind: p.kind,
      label_ja: p.label_ja,
      label_ko: p.label_ko,
      hits: p.evidence.length,
      open: () =>
        onOpen({
          kind: "quotes",
          title: `${SNS_PATTERN_KIND_LABEL[p.kind]} · ${p.label_ja ?? p.label_ko}`,
          description: `${r.videos.length}개 영상 중 ${p.evidence.length}개 · AI 분석 결과`,
          quotes: p.evidence.map((e) => {
            const v = r.videos.find((x) => x.index === e.video);
            return { ja: e.quote_ja, note: `영상 ${e.video}${v?.author ? ` · @${v.author}` : ""} 메모에서`, href: v?.url };
          }),
          footnote: p.kind === "expression" ? TEXT.notReviewed : TEXT.snsRealBasis,
        }),
    }));
  } else if (!usingReal) {
    const found = commonPatterns(patterns, categoryNotes, category);
    total = categoryNotes.length;
    cards = found.map((p) => ({
      id: p.id,
      kind: p.kind,
      label_ja: p.label_ja,
      label_ko: p.label_ko,
      hits: p.hits.length,
      open: () =>
        onOpen({
          kind: "quotes",
          title: `${SNS_PATTERN_KIND_LABEL[p.kind]} · ${p.label_ja ?? p.label_ko}`,
          description: `${categoryNotes.length}개 영상 중 ${p.hits.length}개`,
          quotes: p.hits.flatMap((id) => {
            const n = categoryNotes.find((x) => x.id === id);
            return n ? [{ ja: n.note_ja, ko: n.note_ko, note: `${SNS_PLATFORM_LABEL[n.platform]} · ${n.title_ja}${n.has_ad_label ? " · 광고 표시 있음" : ""}` }] : [];
          }),
          link: p.related_href ? { href: p.related_href, label: "일본 리뷰 불만과 비교 (소구점 찾기)" } : undefined,
          footnote: p.kind === "expression" ? TEXT.notReviewed : TEXT.snsBasis,
        }),
    }));
  }
  const sampleMeta = patterns.find((p) => p.category === category);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>2-B SNS 공통 패턴</CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            영상 목록·메모 ({withMemo.length}/{videos.length})
          </Button>
          <Button
            size="sm"
            disabled={withMemo.length < MIN_VIDEOS || run.status === "running"}
            onClick={analyze}
            title={withMemo.length < MIN_VIDEOS ? `메모를 적은 영상이 ${MIN_VIDEOS}개 이상이어야 해요` : undefined}
          >
            {run.status === "running" ? "AI 분석 중…" : "AI로 공통 패턴 분석"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {run.status === "error" && <p className="text-sm text-risk-high">⚠ {run.message}</p>}
        {videos.length < MIN_VIDEOS ? (
          <EmptyState message={`영상을 ${MIN_VIDEOS}개 이상 등록하세요`} action="[영상 목록·메모]에서 일본 뷰티 영상 링크와 메모를 넣어요" />
        ) : cards === null ? (
          <EmptyState
            message={`실제 영상 ${videos.length}개가 등록돼 있어요 · 메모 ${withMemo.length}/${videos.length}개 작성`}
            action={`[영상 목록·메모]에서 영상을 보고 핵심 발화·댓글을 메모한 뒤 (${MIN_VIDEOS}개 이상) [AI로 공통 패턴 분석]을 눌러요`}
          />
        ) : (
          <>
            <PatternCards cards={cards} total={total} />
            {run.status === "done" ? (
              <>
                <p className="text-xs text-muted-foreground">
                  {TEXT.snsRealBasis}
                  {run.result.dropped > 0 ? ` · 메모에 없어 버린 근거 ${run.result.dropped}개` : ""} · 누르면 근거 메모
                </p>
                <AiResultMeta model={run.result.model} promptVersion={run.result.prompt_version} createdAt={run.result.analyzed_at} />
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">{TEXT.snsBasis} · 누르면 해당 영상 메모</p>
                {sampleMeta && <AiResultMeta model={sampleMeta.model} promptVersion={sampleMeta.prompt_version} createdAt={sampleMeta.analyzed_at} />}
              </>
            )}
          </>
        )}
      </CardContent>
      <EvidenceSheet open={editing} onOpenChange={setEditing} title="영상 목록·메모" description={`일본 뷰티 영상 링크 ${MIN_VIDEOS}~${MAX_VIDEOS}개와 영상별 핵심 발화·댓글 메모 · 저장되지 않음`}>
        <p className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">{TEXT.stealth}</p>
        <p className="text-xs text-muted-foreground">{TEXT.memoWhy}</p>
        <ul className="space-y-3">
          {videos.map((v, i) => {
            const link = parseTikTokLink(v.url);
            return (
              <li key={v.key} className="space-y-1 rounded-md border p-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 text-xs text-muted-foreground">{i + 1}</span>
                  <Input
                    value={v.url}
                    placeholder="https://www.tiktok.com/@…/video/…"
                    aria-label={`영상 ${i + 1} 링크`}
                    onChange={(e) => setVideos(videos.map((x) => (x.key === v.key ? { ...x, url: e.target.value } : x)))}
                  />
                  <Button size="sm" variant="ghost" onClick={() => setVideos(videos.filter((x) => x.key !== v.key))}>
                    빼기
                  </Button>
                </div>
                {link && (
                  <div className="flex flex-wrap items-center gap-2 pl-8 text-xs text-muted-foreground">
                    <span>
                      @{link.author} · {link.kind === "video" ? "영상" : "사진 게시물"}
                    </span>
                    {link.embedUrl ? (
                      <button type="button" className="underline underline-offset-4" onClick={() => setPreview(preview === v.key ? null : v.key)}>
                        {preview === v.key ? "영상 닫기" : "여기서 영상 보기"}
                      </button>
                    ) : (
                      <span>미리보기 불가</span>
                    )}
                    <a href={link.url} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                      TikTok에서 열기 ↗
                    </a>
                  </div>
                )}
                {link?.embedUrl && preview === v.key && (
                  <div className="pl-8">
                    <iframe src={link.embedUrl} title={`@${link.author} 영상`} className="h-[480px] w-full max-w-[300px] rounded-md border" allow="encrypted-media; fullscreen" />
                  </div>
                )}
                <Textarea
                  value={v.memo}
                  placeholder="핵심 발화·자막·댓글 메모 (일본어 원문 그대로)"
                  aria-label={`영상 ${i + 1} 메모`}
                  onChange={(e) => setVideos(videos.map((x) => (x.key === v.key ? { ...x, memo: e.target.value } : x)))}
                />
              </li>
            );
          })}
        </ul>
        <Button size="sm" variant="outline" disabled={videos.length >= MAX_VIDEOS} onClick={() => setVideos([...videos, { key: `new-${videos.length}-${Date.now()}`, url: "", memo: "" }])}>
          영상 추가
        </Button>
      </EvidenceSheet>
    </Card>
  );
}

// ── 2-C ─────────────────────────────────────────

function GeoBlock({ geo, category, onOpen }: { geo: GeoSnap[]; category: string; onOpen: (c: PanelContent) => void }) {
  const m = geoMatrix(geo, category, OWN_BRAND);
  const sample = geo.find((g) => g.category === category);

  if (m.queries.length === 0)
    return (
      <Card>
        <CardHeader>
          <CardTitle>2-C AI 검색 노출</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState message="이 카테고리는 AI 검색 답변을 아직 모으지 않았어요" />
        </CardContent>
      </Card>
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>2-C AI 검색 노출</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-56">
                질의 <LangBadge lang="ja" />
              </TableHead>
              {m.engines.map((e) => (
                <TableHead key={e} className="min-w-48">
                  {GEO_ENGINE_LABEL[e]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {m.queries.map((q) => {
              const first = geo.find((g) => g.query === q && g.category === category);
              const ko = first ? geoQueryKo(first) : null;
              return (
                <TableRow key={q}>
                  <TableCell className="whitespace-normal align-top">
                    <span lang="ja">{q}</span>
                    {ko && <span className="block text-xs text-muted-foreground">{ko}</span>}
                  </TableCell>
                  {m.engines.map((e) => {
                    const c = m.cell(q, e);
                    if (!c) return <TableCell key={e} className="align-top text-xs text-muted-foreground">측정 안 함</TableCell>;
                    return (
                      <TableCell key={e} className="whitespace-normal p-1 align-top">
                        <button
                          type="button"
                          className="w-full rounded-md p-1.5 text-left text-xs hover:bg-muted"
                          onClick={() =>
                            onOpen({
                              kind: "answers",
                              title: `${GEO_ENGINE_LABEL[e]} 답변 원문`,
                              description: `${q}${ko ? ` (${ko})` : ""}`,
                              answers: c.runs.map((r) => ({
                                heading: `${r.run_index}회차 · ${r.model}`,
                                text: r.answer,
                                marks: [...r.brand_mentions.map((b) => b.matched_text), ...r.keywords.map((k) => k.matched_text)],
                                citations: r.citations,
                              })),
                              footnote: TEXT.geoNote,
                            })
                          }
                        >
                          <span className="block font-medium">{c.ownMentioned ? `✓ 자사 언급 · 점유 ${c.ownShare}%` : "✕ 자사 언급 없음"}</span>
                          <span className="block text-muted-foreground">경쟁 {c.competitors.slice(0, 3).join(", ") || "없음"}</span>
                          <span className="block text-muted-foreground" lang="ja">
                            결정 키워드 {c.keywords.slice(0, 3).map((k) => k.keyword).join("・") || "없음"}
                          </span>
                          <span className="block text-muted-foreground">인용 {c.domains.length > 0 ? c.domains.join(", ") : "출처 없음"}</span>
                          {c.runs.length > 1 && <span className="block text-muted-foreground">{c.runs.length}회 측정 합계</span>}
                        </button>
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground">
          점유 = 그 칸 답변의 브랜드 언급 중 자사 비율 · 인용 출처는 엔진이 줄 때만 · {TEXT.geoNote}
        </p>
        {sample && <AiResultMeta model={[...new Set(geo.filter((g) => g.category === category).map((g) => g.model))].join(", ")} promptVersion={sample.prompt_version ?? "사전 대조"} createdAt={m.measuredAt ?? sample.captured_at} />}
      </CardContent>
    </Card>
  );
}

/** PART 2. 소비자 트렌드: 검색 자동완성 변화 · SNS 공통 패턴 · AI 검색 노출 */
export function DemandPart({
  search,
  snsNotes,
  snsPatterns,
  geo,
  products,
  snsImported,
  category,
  onOpen,
}: {
  search: SearchSnap[];
  snsNotes: SnsVideoNote[];
  snsPatterns: SnsPattern[];
  geo: GeoSnap[];
  products: Product[];
  /** 이 PC에 있는 실제 영상 목록 (없으면 빈 배열 → 샘플) */
  snsImported: { category: string; url: string; memo: string }[];
  category: string;
  onOpen: (c: PanelContent) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <AutocompleteBlock search={search} category={category} onOpen={onOpen} />
        <SnsBlock notes={snsNotes} patterns={snsPatterns} imported={snsImported} category={category} onOpen={onOpen} />
      </div>
      {/* 예전 성분 관심도 화면에서 옮김: 성분 검색 관심도 순위와 지금 수집 버튼 */}
      <Card>
        <CardHeader>
          <CardTitle>성분 검색 관심도 · 지금 수집</CardTitle>
        </CardHeader>
        <CardContent>
          <SearchTrendCard initial={search} category={category} />
        </CardContent>
      </Card>
      <GeoBlock geo={geo} category={category} onOpen={onOpen} />
      {/* 예전 시장 트렌드 화면에서 옮김: 여러 답변을 모은 핵심 포인트와 AI 질의(측정) 버튼 */}
      <div>
        <h3 className="mb-2 text-sm font-semibold">AI 검색 핵심 포인트 · 측정</h3>
        <GeoInsights initial={geo.map((g, i) => ({ ...g, id: `geo-row-${i}` }))} ownProducts={products.filter((p) => p.kind === "own")} category={category} />
      </div>
    </div>
  );
}
