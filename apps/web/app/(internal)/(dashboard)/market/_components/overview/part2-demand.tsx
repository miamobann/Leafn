"use client";

import { useState } from "react";
import { LangBadge } from "@/components/common/badges";
import { EvidenceSheet } from "@/components/common/evidence-sheet";
import { HelpTip } from "@/components/common/help-tip";
import { EmptyState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";
import { SNS_PLATFORM_LABEL, SnsTrendResult, type SnsPattern, type SnsPatternKind, type SnsVideoNote } from "@/lib/schemas/market";
import { parseTikTokLink } from "@/lib/external/tiktok";
import type { SearchSnap } from "@/lib/schemas/search";
import {
  AUTOCOMPLETE_STATUS_LABEL,
  concernSuggestions,
  commonPatterns,
  SNS_PATTERN_KIND_LABEL,
  type AutocompleteRow,
  type AutocompleteStatus,
} from "@/app/(internal)/(dashboard)/market/_lib/demand";
import { ToggleGroup } from "@/app/(internal)/(dashboard)/market/_components/toggle-group";
import { IngredientInterestCard, SearchCollectBar } from "@/app/(internal)/(dashboard)/market/_components/search-trend";
import type { PanelContent } from "./side-panel";

// 화면 문구
const TEXT = {
  autocompleteNote: "고민 단어를 치면 구글 검색창이 띄우는 추천어예요 (검색량이 아니에요). 지난 수집과 비교해 새로 나타난 말·사라진 말을 표시해요 · おすすめ 같은 일반어는 뺐어요",
  snsBasis: "선택한 영상 기준 · 마케터가 고른 영상이라 시장 전체를 대표하지 않아요 · 고정된 샘플 결과 · 저장되지 않음",
  snsRealBasis: "영상의 캡션·해시태그·발화 자막(TikTok 자동 자막)을 AI가 읽은 결과 · 키워드·근거는 영상 정보에 그대로 있는 말만 · 고른 영상 기준이라 시장 전체를 대표하지 않아요 · 저장되지 않음",
  memoWhy: "링크만 넣으면 돼요. [분석 시작]을 누르면 영상의 캡션·해시태그·조회수·발화 자막을 가져와(Apify) AI가 소비자 핵심 니즈를 많이 나온 순으로 골라요. 메모는 선택이에요 (적으면 같이 분석).",
  stealth: "광고 표시가 없어도 광고가 아닌 영상이라는 보장은 없어요 (2023년 10월 시행 ステマ規制). 영상 설명·고정 댓글의 #PR·提供 표기도 확인해 주세요.",
  notReviewed: "소비자 표현은 약기법 검토 전이에요. 효능을 단정하는 말은 광고에 그대로 쓸 수 없을 수 있어요.",
};

const STATUS_MARK: Record<AutocompleteStatus, string> = { new: "＋", kept: "–", gone: "✕" };
const MIN_VIDEOS = 2;
const MAX_VIDEOS = 10;
const KIND_ORDER: SnsPatternKind[] = ["expression", "opening", "reason"];

// ── 2-A ─────────────────────────────────────────

function StatusText({ status }: { status: AutocompleteStatus }) {
  const tone = status === "new" ? "text-risk-low" : status === "gone" ? "text-risk-high" : "text-muted-foreground";
  return (
    <span className={`shrink-0 text-xs font-medium ${tone}`}>
      {STATUS_MARK[status]} {AUTOCOMPLETE_STATUS_LABEL[status]}
    </span>
  );
}

function AutocompleteBlock({ search, onOpen }: { search: SearchSnap[]; onOpen: (c: PanelContent) => void }) {
  const data = concernSuggestions(search);
  const labels = data.groups.map((g) => g.ko);
  const [tab, setTab] = useState<string>(labels[0] ?? "");
  const group = data.groups.find((g) => g.ko === tab) ?? data.groups[0];
  // 첫 수집이면 비교할 지난 수집이 없어 이번 추천어를 모두 보여준다. 두 번째부터는 새로 나타난 말 → 계속 보인 말 → 사라진 말 순
  const firstCollection = !data.prev;
  const rows = group?.rows ?? [];

  const open = (r: AutocompleteRow) =>
    onOpen({
      kind: "quotes",
      title: `「${group?.seed}」 추천어 · ${r.term}`,
      description: firstCollection ? `이번 추천어 ${r.latestPos}번째` : AUTOCOMPLETE_STATUS_LABEL[r.status],
      quotes: r.evidence.map((e) => ({ ja: e.value, note: `${e.date} · 추천어 ${e.position}번째` })),
      footnote: TEXT.autocompleteNote,
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          2-A 피부 고민별 검색 추천어 <LangBadge lang="ja" />
          <HelpTip>
            <span className="block">{TEXT.autocompleteNote}</span>
            <span className="block">일본 구글 기준이라 카테고리와 상관없이 같아요. 추천어를 누르면 원문이 열려요.</span>
            {data.latest && <span className="block">{firstCollection ? `${data.latest} 첫 수집 (다음 수집부터 새로 나타난 말·사라진 말)` : `${data.prev} → ${data.latest} 비교`}</span>}
          </HelpTip>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!data.latest ? (
          <EmptyState message="아직 고민별 추천어를 모으지 않았어요" action="위 [자동완성 지금 수집]을 눌러 주세요" />
        ) : (
          <>
            <ToggleGroup label="고민" options={labels} value={group?.ko ?? ""} onChange={setTab} />
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">「{group?.seed}」 뒤에 붙는 추천어가 없어요 (일반어만 나왔어요)</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {rows.map((r) => (
                  <li key={r.key}>
                    <button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => open(r)}>
                      <span className="min-w-0">
                        <span lang="ja" className="text-muted-foreground">
                          {group?.seed}{" "}
                        </span>
                        <span lang="ja" className="font-medium">
                          {r.term}
                        </span>
                        {r.ko && <span className="ml-2 text-xs text-muted-foreground">{r.ko}</span>}
                      </span>
                      {firstCollection ? <span className="shrink-0 text-xs text-muted-foreground">{r.latestPos}번째</span> : <StatusText status={r.status} />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── 2-B ─────────────────────────────────────────

type VideoDraft = { key: string; url: string; memo: string };
type RunState = { status: "idle" } | { status: "running" } | { status: "done"; result: SnsTrendResult } | { status: "error"; message: string };

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

const compact = new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 });
const count = (n: number | null) => (n === null ? "—" : compact.format(n));

/** [분석 시작] 결과: 소비자 핵심 니즈 순위 · 많이 나온 키워드 순위 · 가져온 영상 정보 */
function SnsTrendView({ result, onOpen }: { result: SnsTrendResult; onOpen: (c: PanelContent) => void }) {
  const ok = result.videos.filter((v) => !v.error);
  const failed = result.videos.filter((v) => v.error);
  const label = (index: number) => {
    const v = result.videos[index - 1];
    return `영상 ${index}${v?.author ? ` · @${v.author}` : ""}${v?.play_count != null ? ` · 조회 ${count(v.play_count)}` : ""}`;
  };
  // 니즈를 누르면 근거 문구 (영상마다 하나)
  const openNeed = (n: SnsTrendResult["needs"][number]) =>
    onOpen({
      kind: "quotes",
      title: `핵심 니즈 · ${n.need_ko}`,
      description: `${ok.length}개 영상 중 ${n.videos.length}개 · ${n.summary_ko}`,
      quotes: n.evidence.map((e) => ({ ja: e.quote_ja, note: label(e.video), href: result.videos[e.video - 1]?.url })),
      footnote: `${TEXT.snsRealBasis} · ${TEXT.notReviewed}`,
    });

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">소비자 핵심 니즈 순위 (언급한 영상이 많은 순 → 조회수 합)</p>
        {result.needs.length === 0 ? (
          <p className="text-sm text-muted-foreground">영상 2개 이상에 공통된 니즈가 없어요. 영상을 더 넣어 주세요</p>
        ) : (
          <ol className="divide-y rounded-md border">
            {result.needs.map((n, i) => (
              <li key={n.need_ko}>
                <button type="button" onClick={() => openNeed(n)} className="flex w-full gap-3 px-3 py-2 text-left hover:bg-muted">
                  <span className="w-5 shrink-0 text-lg font-bold leading-6 tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-semibold">{n.need_ko}</span>
                      <span className="text-xs text-muted-foreground">
                        {ok.length}개 영상 중 {n.videos.length}개 · 조회 합 {count(n.views)}
                      </span>
                    </span>
                    <span className="block text-sm text-muted-foreground">{n.summary_ko}</span>
                    <span className="flex flex-wrap gap-1">
                      {n.keywords.map((k) => (
                        <Badge key={k.keyword_ja} variant="outline" className="font-normal">
                          <span lang="ja">{k.keyword_ja}</span>
                          <span className="text-muted-foreground">{k.keyword_ko}</span>
                        </Badge>
                      ))}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
      {result.keywords.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">많이 나온 키워드 Top {result.keywords.length}</p>
          <ol className="grid gap-x-6 text-sm sm:grid-cols-2">
            {result.keywords.map((k, i) => (
              <li key={k.keyword_ja} className="flex items-baseline gap-2 border-b py-1">
                <span className="w-5 shrink-0 font-semibold tabular-nums">{i + 1}</span>
                <span lang="ja" className="font-medium">
                  {k.keyword_ja}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {k.keyword_ko} · {k.need_ko}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{k.videos.length}개 영상</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <details className="rounded-md border">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">가져온 영상 정보 ({ok.length}/{result.videos.length}개)</summary>
        <ul className="divide-y text-xs">
          {result.videos.map((v) => (
            <li key={v.index} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5">
              <a href={v.url} target="_blank" rel="noreferrer" className="font-medium underline-offset-4 hover:underline">
                {v.index}. {v.author ? `@${v.author}` : "영상"} ↗
              </a>
              {v.error ? (
                <span className="text-risk-high">{v.error}</span>
              ) : (
                <>
                  <span className="text-muted-foreground">
                    조회 {count(v.play_count)} · 좋아요 {count(v.like_count)} · 저장 {count(v.save_count)}
                  </span>
                  <span className="text-muted-foreground">{v.transcript ? "발화 자막 있음" : "발화 자막 없음 (캡션만)"}</span>
                  {v.is_ad && <Badge variant="outline">광고 표시</Badge>}
                </>
              )}
            </li>
          ))}
        </ul>
      </details>
      <p className="text-xs text-muted-foreground">
        AI 분석 {formatDate(result.analyzed_at)}
        {failed.length > 0 ? ` · 못 가져온 영상 ${failed.length}개는 빼고 분석` : ""}
        {result.dropped > 0 ? ` · 영상 정보에 없어 버린 말 ${result.dropped}개` : ""}
      </p>
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
  // 분석에 넣을 영상: TikTok 링크로 읽히는 것만 (메모는 선택)
  const linked = videos.filter((v) => parseTikTokLink(v.url.trim()));

  async function analyze() {
    setRuns((r) => ({ ...r, [category]: { status: "running" } }));
    try {
      const res = await fetch("/api/market/sns-trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, videos: linked.map((v) => ({ url: v.url.trim(), memo: v.memo.trim() })) }),
      });
      const body: unknown = await res.json();
      if (!res.ok) {
        const message = typeof body === "object" && body && "error" in body && typeof body.error === "string" ? body.error : `오류 (${res.status})`;
        return setRuns((r) => ({ ...r, [category]: { status: "error", message } }));
      }
      setRuns((r) => ({ ...r, [category]: { status: "done", result: SnsTrendResult.parse(body) } }));
    } catch (e) {
      setRuns((r) => ({ ...r, [category]: { status: "error", message: e instanceof Error ? e.message : "요청 실패" } }));
    }
  }

  // 분석 전 샘플 영상이면 고정 샘플 결과를 보여준다 (실제 영상은 [분석 시작] 전까지 비워 둔다)
  let sampleCards: PatternCard[] | null = null;
  if (run.status !== "done" && !usingReal) {
    const found = commonPatterns(patterns, categoryNotes, category);
    sampleCards = found.map((p) => ({
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

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-1.5">
          2-B SNS 소비자 핵심 니즈
          <HelpTip>
            <span className="block">{TEXT.memoWhy}</span>
            <span className="block">{TEXT.snsRealBasis}</span>
            <span className="block">순위 = 그 니즈를 언급한 영상 수 → 조회수 합. 니즈·키워드를 누르면 근거 문구와 영상이 열려요.</span>
            <span className="block">{TEXT.stealth}</span>
          </HelpTip>
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            영상 링크 ({linked.length})
          </Button>
          <Button
            size="sm"
            disabled={linked.length < MIN_VIDEOS || run.status === "running"}
            onClick={analyze}
            title={linked.length < MIN_VIDEOS ? `TikTok 영상 링크가 ${MIN_VIDEOS}개 이상이어야 해요` : undefined}
          >
            {run.status === "running" ? "영상 가져와 분석 중… (1분 안팎)" : "분석 시작"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {run.status === "error" && <p className="text-sm text-risk-high">⚠ {run.message}</p>}
        {run.status === "done" ? (
          <SnsTrendView result={run.result} onOpen={onOpen} />
        ) : sampleCards ? (
          <>
            <PatternCards cards={sampleCards} total={categoryNotes.length} />
            <p className="text-xs text-muted-foreground">샘플 결과예요 · 실제 영상은 [영상 링크]에 넣고 [분석 시작]</p>
          </>
        ) : (
          <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
            TikTok 영상 {linked.length}개 준비됨 · [분석 시작]을 누르면 소비자 핵심 니즈를 많이 나온 순으로 보여 줘요 (1분 안팎)
          </p>
        )}
      </CardContent>
      <EvidenceSheet open={editing} onOpenChange={setEditing} title="영상 링크" description={`일본 뷰티 TikTok 영상 링크 ${MIN_VIDEOS}~${MAX_VIDEOS}개 · 메모는 선택 · 저장되지 않음`}>
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
                  placeholder="메모 (선택) · 영상에서 눈에 띈 점이 있으면 적어요"
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

/** PART 2. 소비자 트렌드: 검색 자동완성 변화 · SNS 공통 패턴 · 성분 검색 관심도 */
export function DemandPart({
  search,
  onSearchCollected,
  snsNotes,
  snsPatterns,
  snsImported,
  category,
  onOpen,
}: {
  search: SearchSnap[];
  /** 지금 수집한 검색 데이터를 원페이지에 올린다 */
  onSearchCollected: (added: SearchSnap[]) => void;
  snsNotes: SnsVideoNote[];
  snsPatterns: SnsPattern[];
  /** 이 PC에 있는 실제 영상 목록 (없으면 빈 배열 → 샘플) */
  snsImported: { category: string; url: string; memo: string }[];
  category: string;
  onOpen: (c: PanelContent) => void;
}) {
  return (
    <div className="space-y-4">
      {/* 수집 버튼은 맨 위 (2026-10-25): 누르면 아래 2-A·성분 검색 관심도가 바로 바뀐다 */}
      <SearchCollectBar category={category} onCollected={onSearchCollected} />
      {/* 검색 데이터(구글) 두 카드를 나란히, SNS는 결과가 길어 한 줄 전체 */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <AutocompleteBlock search={search} onOpen={onOpen} />
        <IngredientInterestCard snaps={search} category={category} />
      </div>
      <SnsBlock notes={snsNotes} patterns={snsPatterns} imported={snsImported} category={category} onOpen={onOpen} />
    </div>
  );
}
