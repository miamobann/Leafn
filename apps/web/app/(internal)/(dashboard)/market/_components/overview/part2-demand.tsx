"use client";

import Papa from "papaparse";
import { useRef, useState } from "react";
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
import { SnsTrendResult } from "@/lib/schemas/market";
import { saveSnsAnalysisJson } from "@/lib/data/sns-analysis-actions";
import { parseTikTokLink } from "@/lib/external/tiktok";
import type { SearchSnap } from "@/lib/schemas/search";
import { AUTOCOMPLETE_STATUS_LABEL, concernSuggestions, type AutocompleteRow, type AutocompleteStatus } from "@/app/(internal)/(dashboard)/market/_lib/demand";
import { ToggleGroup } from "@/app/(internal)/(dashboard)/market/_components/toggle-group";
import { IngredientInterestCard, SearchCollectBar } from "@/app/(internal)/(dashboard)/market/_components/search-trend";
import type { PanelContent } from "./side-panel";

// 화면 문구
const TEXT = {
  autocompleteNote: "고민 단어를 치면 구글 검색창이 띄우는 추천어예요 (검색량이 아니에요). 지난 수집과 비교해 새로 나타난 말·사라진 말을 표시해요 · おすすめ 같은 일반어는 뺐어요",
  snsRealBasis: "영상의 캡션·해시태그·발화 자막(TikTok 자동 자막)을 AI가 읽은 결과 · 키워드·근거는 영상 정보에 그대로 있는 말만 · 고른 영상 기준이라 시장 전체를 대표하지 않아요 · 결과는 팀 DB에 저장돼요",
  videoCsv: "영상 목록 CSV: 열 이름 category · url · memo (카테고리 · 링크 · 메모도 돼요). 카테고리마다 최대 10개를 분석 목록에 채워요. 파일은 저장하지 않아요",
  resultJson: "PC에서 따로 돌린 분석 결과 JSON(화면의 분석 결과와 같은 모양)을 올리면 팀 DB에 저장해요",
  memoWhy: "링크만 넣으면 돼요. [분석 시작]을 누르면 영상의 캡션·해시태그·조회수·발화 자막을 가져와(Apify) AI가 소비자 핵심 니즈를 많이 나온 순으로 골라요. 메모는 선택이에요 (적으면 같이 분석).",
  stealth: "광고 표시가 없어도 광고가 아닌 영상이라는 보장은 없어요 (2023년 10월 시행 ステマ規制). 영상 설명·고정 댓글의 #PR·提供 표기도 확인해 주세요.",
  notReviewed: "소비자 표현은 약기법 검토 전이에요. 효능을 단정하는 말은 광고에 그대로 쓸 수 없을 수 있어요.",
};

const STATUS_MARK: Record<AutocompleteStatus, string> = { new: "＋", kept: "–", gone: "✕" };
const MIN_VIDEOS = 2;
const MAX_VIDEOS = 10;

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

/** 영상 목록 CSV(category · url · memo) → 카테고리별 분석 목록 (브라우저에서만 읽고 저장하지 않는다) */
function parseVideoCsv(text: string): Record<string, VideoDraft[]> {
  const { data } = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: true });
  const pick = (r: Record<string, string>, keys: string[]) => (keys.map((k) => r[k]).find((v) => v !== undefined) ?? "").trim();
  const out: Record<string, VideoDraft[]> = {};
  data.forEach((r, i) => {
    const category = pick(r, ["category", "카테고리"]);
    const url = pick(r, ["url", "링크", "URL"]);
    if (!category || !url) return;
    const list = (out[category] ??= []);
    if (list.length < MAX_VIDEOS) list.push({ key: `csv-${i}`, url, memo: pick(r, ["memo", "메모"]) });
  });
  return out;
}

function SnsBlock({
  latest,
  onAnalyzed,
  category,
  onOpen,
}: {
  /** 이 카테고리의 마지막 저장 분석 (DB, 샘플 모드는 mock). 없으면 null */
  latest: SnsTrendResult | null;
  /** 새 분석 결과 (분석 시작 · 결과 JSON 올리기) → 원페이지 한 벌에 더한다 (요약도 같이 바뀐다) */
  onAnalyzed: (result: SnsTrendResult) => void;
  category: string;
  onOpen: (c: PanelContent) => void;
}) {
  // 카테고리별 편집 목록 (화면 상태, 저장되지 않음). 처음에는 마지막 분석의 영상으로 채운다
  const [drafts, setDrafts] = useState<Record<string, VideoDraft[]>>({});
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [runs, setRuns] = useState<Record<string, RunState>>({});
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const csvInput = useRef<HTMLInputElement>(null);
  const jsonInput = useRef<HTMLInputElement>(null);
  const videos = drafts[category] ?? (latest?.videos ?? []).map((v) => ({ key: `last-${v.index}`, url: v.url, memo: "" }));
  const setVideos = (next: VideoDraft[]) => setDrafts((d) => ({ ...d, [category]: next }));
  const run = runs[category] ?? { status: "idle" };
  // 분석에 넣을 영상: TikTok 링크로 읽히는 것만 (메모는 선택)
  const linked = videos.filter((v) => parseTikTokLink(v.url.trim()));
  const shown = run.status === "done" ? run.result : latest;

  async function analyze() {
    setNotice(null);
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
      const result = SnsTrendResult.parse(body);
      onAnalyzed(result);
      setRuns((r) => ({ ...r, [category]: { status: "done", result } }));
    } catch (e) {
      setRuns((r) => ({ ...r, [category]: { status: "error", message: e instanceof Error ? e.message : "요청 실패" } }));
    }
  }

  async function loadCsv(file: File | undefined) {
    if (!file) return;
    const byCategory = parseVideoCsv(await file.text());
    const names = Object.keys(byCategory);
    if (names.length === 0) return setNotice({ tone: "error", text: "읽을 줄이 없어요. 열 이름(category · url · memo)을 확인해 주세요." });
    setDrafts((d) => ({ ...d, ...byCategory }));
    setNotice({ tone: "ok", text: `${names.map((c) => `${c} ${byCategory[c].length}개`).join(" · ")} 불러옴 · [분석 시작]을 누르면 분석해요` });
  }

  async function loadJson(file: File | undefined) {
    if (!file) return;
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      return setNotice({ tone: "error", text: "JSON 파일을 읽지 못했어요" });
    }
    const r = await saveSnsAnalysisJson(raw);
    if (!r.ok) return setNotice({ tone: "error", text: r.message });
    onAnalyzed(r.result);
    setNotice({ tone: r.result.saved ? "ok" : "error", text: r.result.saved ? `${r.result.category} 분석 결과를 저장했어요` : `화면에만 반영했어요 (${r.result.save_error})` });
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
            <span className="block">{TEXT.videoCsv}</span>
            <span className="block">{TEXT.resultJson}</span>
            <span className="block">{TEXT.stealth}</span>
          </HelpTip>
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          <input ref={csvInput} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => loadCsv(e.target.files?.[0]).finally(() => (e.target.value = ""))} />
          <input ref={jsonInput} type="file" accept=".json,application/json" className="hidden" onChange={(e) => loadJson(e.target.files?.[0]).finally(() => (e.target.value = ""))} />
          <Button size="sm" variant="ghost" onClick={() => csvInput.current?.click()}>
            영상 목록 CSV
          </Button>
          <Button size="sm" variant="ghost" onClick={() => jsonInput.current?.click()}>
            결과 JSON 올리기
          </Button>
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
        {notice && <p className={`text-sm ${notice.tone === "error" ? "text-risk-high" : "text-muted-foreground"}`}>{notice.text}</p>}
        {run.status === "error" && <p className="text-sm text-risk-high">⚠ {run.message}</p>}
        {shown ? (
          <>
            <SnsTrendView result={shown} onOpen={onOpen} />
            <p className="text-xs text-muted-foreground">
              {run.status === "done"
                ? run.result.saved
                  ? "방금 분석한 결과 · 팀 DB에 저장됨"
                  : `방금 분석한 결과 · 저장 안 됨 (${run.result.save_error ?? "이유 모름"})`
                : `마지막 저장 분석 ${formatDate(shown.analyzed_at)} · 새로 보려면 [분석 시작]`}
            </p>
          </>
        ) : (
          <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
            {linked.length > 0
              ? `TikTok 영상 ${linked.length}개 준비됨 · [분석 시작]을 누르면 소비자 핵심 니즈를 많이 나온 순으로 보여 줘요 (1분 안팎)`
              : "아직 분석이 없어요 · [영상 링크]에 TikTok 링크를 넣거나 [영상 목록 CSV]로 불러온 뒤 [분석 시작]"}
          </p>
        )}
      </CardContent>
      <EvidenceSheet open={editing} onOpenChange={setEditing} title="영상 링크" description={`일본 뷰티 TikTok 영상 링크 ${MIN_VIDEOS}~${MAX_VIDEOS}개 · 메모는 선택 · 분석하면 링크·메모가 결과와 함께 저장돼요`}>
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

/** PART 2. 소비자 트렌드: 검색 자동완성 변화 · SNS 핵심 니즈 · 성분 검색 관심도 */
export function DemandPart({
  search,
  onSearchCollected,
  snsLatest,
  onSnsAnalyzed,
  category,
  onOpen,
}: {
  search: SearchSnap[];
  /** 지금 수집한 검색 데이터를 원페이지에 올린다 */
  onSearchCollected: (added: SearchSnap[]) => void;
  /** 이 카테고리의 마지막 저장 SNS 분석 */
  snsLatest: SnsTrendResult | null;
  onSnsAnalyzed: (result: SnsTrendResult) => void;
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
      <SnsBlock latest={snsLatest} onAnalyzed={onSnsAnalyzed} category={category} onOpen={onOpen} />
    </div>
  );
}
