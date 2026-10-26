"use client";

// 소구점 찾기 (prototype-plan P4, 2026-10-24 목업 수정안).
// 맨 위에 결론(소구점 후보 → 고른 후보의 소구 정리)을 두고, 비교 대상 랭킹은 그 아래, 근거 리뷰는 누를 때만 오른쪽에 연다.
// 리뷰끼리 맞대는 게 목적이 아니라 주제 단위로 비교하고, 리뷰는 AI 분류가 맞는지 확인하는 증거로만 보여준다
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, ChevronRight, Info } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { addToReviewDraft, removeFromReviewDraft } from "@/lib/data/submission-actions";
import type { AppealComparisonView } from "@/lib/data/reviews";
import { euroOf } from "@/lib/korean";
import { titleParts } from "@/lib/product-title";
import { APPEAL_TOPICS, type AppealTopic } from "@/lib/schemas/review";
import { EvidencePanel, linkClass, paginate, Pager, ReviewCard, SegmentTabs } from "../_components/parts";
import { distribution, share } from "../_lib/topics";

export type AppealComparison = AppealComparisonView;
/** 제품별 리뷰 분석 시안 상태: 담을 수 있는가, 지금 담긴 소구점 */
export type AppealDraft = { canAdd: boolean; reason: string | null; versionNo: number | null; topics: AppealTopic[] };
type TopicRow = AppealComparison["topics"][number];

const RANK_PAGE = 10;
const EVIDENCE_STEP = 3;

const TEXT = {
  caution:
    "경쟁 제품을 지목하거나 깎아내리는 문구는 쓸 수 없어요(他社製品の誹謗広告の制限). 소구점은 자사 제품의 장점으로만 표현하고, 효능 표현은 광고 검토를 거쳐 주세요.",
  noCandidate: "기준을 넘는 소구점 후보가 없어요. 경쟁 제품 리뷰를 더 가져오면 달라질 수 있어요.",
  noLowReviews: (max: number) => `비교할 경쟁 제품의 별점 1~${max}점 리뷰가 아직 없어요. 리뷰 가져오기에서 이 제품의 경쟁 제품 리뷰를 저장해 주세요.`,
  pickHint: "여러 개 고르면 아래 정리가 합쳐져요",
  pickNone: "후보를 하나 이상 고르면 소구 정리가 보여요",
} as const;

/** 후보가 0개인 이유. 분석 전이면 "후보 없음"이 아니라 아직 계산할 수 없는 것이다 */
function emptyReason(d: AppealComparison) {
  if (d.lowReviewCount === 0) return TEXT.noLowReviews(d.maxRating);
  if (d.ownAnalyzedCount === 0 || d.lowAnalyzedCount === 0) {
    return `리뷰는 있지만 AI 분석 전이라 후보를 계산할 수 없어요 (분석된 리뷰: 자사 ${d.ownAnalyzedCount}/${d.ownReviewCount}건 · 경쟁 ${d.lowAnalyzedCount}/${d.lowReviewCount}건).`;
  }
  return TEXT.noCandidate;
}

export function AppealCompare({
  comparisons,
  initialOwnId,
  initialTopics,
  drafts,
}: {
  comparisons: AppealComparison[];
  initialOwnId?: string;
  initialTopics: AppealTopic[];
  drafts: Record<string, AppealDraft>;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const start = comparisons.find((c) => c.own.id === initialOwnId) ?? comparisons[0];
  const candidatesOf = (c: AppealComparison | undefined) => c?.topics.filter((t) => t.isCandidate) ?? [];
  const firstPick = (c: AppealComparison | undefined, wanted: AppealTopic[]) => {
    const ids = candidatesOf(c).map((t) => t.topic);
    const chosen = wanted.filter((t) => ids.includes(t));
    return new Set(chosen.length ? chosen : ids);
  };

  const [productId, setProductId] = useState(start?.own.id);
  const [picked, setPicked] = useState<Set<AppealTopic>>(() => firstPick(start, initialTopics));
  const [panel, setPanel] = useState<{ topic: AppealTopic; tab: "complaints" | "praises" } | null>(null);
  const [shown, setShown] = useState(EVIDENCE_STEP);
  const [rankFilter, setRankFilter] = useState<"all" | "hit">("all");
  const [rankPage, setRankPage] = useState(1);
  const [showEmpty, setShowEmpty] = useState(false);

  const data = comparisons.find((c) => c.own.id === productId) ?? comparisons[0];
  if (!data) return null;

  const candidates = candidatesOf(data);
  const chosen = candidates.filter((t) => picked.has(t.topic));
  const draft = drafts[data.own.id];
  const drafted = new Set(draft?.topics ?? []);
  const toAdd = chosen.filter((t) => !drafted.has(t.topic));
  const addToDraft = async () => {
    setSaving(true);
    setNotice(null);
    const res = await addToReviewDraft(data.own.id, { topics: toAdd.map((t) => t.topic) });
    setSaving(false);
    setNotice(
      res.ok
        ? { text: `소구점 ${toAdd.length}개를 시안 v${res.data.versionNo}에 담았어요. 요약 탭에서 한 줄 결론을 쓰고 결재를 올려 주세요.`, error: false }
        : { text: res.message, error: true },
    );
    router.refresh();
  };
  const removeFromDraft = async (topic: AppealTopic) => {
    setSaving(true);
    setNotice(null);
    const res = await removeFromReviewDraft(data.own.id, { topic });
    setSaving(false);
    setNotice(res.ok ? { text: `시안 v${res.data.versionNo}에서 ${APPEAL_TOPICS[topic].name}을(를) 뺐어요.`, error: false } : { text: res.message, error: true });
    router.refresh();
  };
  const focus = chosen[0] ?? candidates[0];
  const panelRow = panel && data.topics.find((t) => t.topic === panel.topic);

  const switchProduct = (id: string) => {
    setProductId(id);
    setPicked(firstPick(comparisons.find((c) => c.own.id === id), []));
    setPanel(null);
    setRankPage(1);
    setRankFilter("all");
  };
  const toggle = (topic: AppealTopic) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });
  const openPanel = (topic: AppealTopic, tab: "complaints" | "praises" = "complaints") => {
    setPanel({ topic, tab });
    setShown(EVIDENCE_STEP);
  };

  // 소구 정리: 고른 후보의 불만을 쓴 사람, 함께 쓸 자사 리뷰(후보마다 별점 높은 최근 리뷰 1건)
  const complaintsAll = chosen.flatMap((t) => t.complaints).filter((r, i, all) => all.findIndex((x) => x.id === r.id) === i);
  const skin = distribution(complaintsAll, (r) => r.reviewer_attrs?.skin_type);
  const age = distribution(complaintsAll, (r) => r.reviewer_attrs?.age_group);
  const quotes = chosen.flatMap((t) => {
    const best = t.praises.toSorted((a, b) => b.rating - a.rating || b.posted_at.localeCompare(a.posted_at))[0];
    return best ? [{ review: best, topic: t.topic }] : [];
  });

  // 비교 대상 랭킹: 리뷰를 가져온 제품만 계산에 쓰고, 안 가져온 제품은 맨 아래 한 줄로 접는다
  const imported = data.competitors.filter((p) => p.lowReviewCount > 0);
  const notImported = data.competitors.filter((p) => p.lowReviewCount === 0);
  const hitCount = (productIdOf: string) => focus?.complaints.filter((r) => r.product_id === productIdOf).length ?? 0;
  const rankRows = rankFilter === "hit" ? imported.filter((p) => hitCount(p.id) > 0) : imported;
  const rankPaged = paginate(rankRows, rankPage, RANK_PAGE);
  const productName = (id: string) => {
    const p = data.competitors.find((c) => c.id === id);
    return p ? `${p.rank}위 ${p.brand}` : "";
  };

  const panelReviews = panelRow ? (panel.tab === "complaints" ? panelRow.complaints : panelRow.praises) : [];
  const negLabel = (t: TopicRow) => APPEAL_TOPICS[t.topic].negative.ko;
  const posLabel = (t: TopicRow) => APPEAL_TOPICS[t.topic].positive.ko;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">자사 제품</span>
        {comparisons.map((c) => (
          <button
            key={c.own.id}
            type="button"
            aria-pressed={c.own.id === data.own.id}
            onClick={() => switchProduct(c.own.id)}
            className={buttonVariants({ variant: c.own.id === data.own.id ? "default" : "outline" })}
          >
            {c.own.name.replace(/^Leaf& Dew /, "")}
          </button>
        ))}
        <span className="ml-1 text-sm text-muted-foreground">
          자사 국내 리뷰 {data.ownReviewCount}건 · 경쟁 제품 별점 1~{data.maxRating}점 리뷰 {data.lowReviewCount}건
        </span>
      </div>

      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">{TEXT.caution}</p>

      <div className={`grid items-start gap-4 ${panelRow ? "xl:grid-cols-[minmax(0,1fr)_380px]" : ""}`}>
        <main className="min-w-0 space-y-4">
          <section className="space-y-4 rounded-xl border bg-card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">소구점 후보 {candidates.length}개</h2>
              <span className="group relative inline-flex">
                <button type="button" aria-label="소구점 후보 기준" className="rounded-full p-0.5 text-muted-foreground hover:text-foreground">
                  <Info className="size-4" />
                </button>
                <span
                  role="tooltip"
                  className="invisible absolute top-7 left-0 z-10 w-80 rounded-lg bg-foreground px-3.5 py-3 text-sm leading-relaxed text-background shadow-lg group-focus-within:visible group-hover:visible"
                >
                  <b>세 가지를 모두 만족하면 후보예요</b>
                  <br />· 경쟁 제품 불만이 {data.rule.minComplaints}건 이상
                  <br />· 자사 칭찬이 {data.rule.minPraises}건 이상
                  <br />· 자사 칭찬이 자사의 같은 불만보다 {data.rule.praiseToComplaintRatio}배 이상
                </span>
              </span>
              {candidates.length > 1 && (
                <>
                  <span className="text-sm text-muted-foreground">{TEXT.pickHint}</span>
                  <button
                    type="button"
                    onClick={() => setPicked(new Set(candidates.map((t) => t.topic)))}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    모두 선택
                  </button>
                </>
              )}
            </div>

            {candidates.length === 0 && <p className="text-sm text-muted-foreground">{emptyReason(data)}</p>}
            <div role="group" aria-label="소구점 후보 선택" className="grid gap-3 md:grid-cols-3">
              {candidates.map((t) => {
                const on = picked.has(t.topic);
                return (
                  <button
                    key={t.topic}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(t.topic)}
                    className={`flex items-start gap-3 rounded-lg border p-4 text-left text-sm transition-colors hover:bg-muted/50 ${on ? "border-foreground" : ""}`}
                  >
                    <span className={`mt-0.5 flex size-[18px] flex-none items-center justify-center rounded border ${on ? "border-foreground bg-foreground text-background" : "border-stone-400"}`}>
                      {on && <Check className="size-3" />}
                    </span>
                    <span className="space-y-1">
                      <span className="block font-semibold">
                        {APPEAL_TOPICS[t.topic].name}
                        {drafted.has(t.topic) && <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-normal text-emerald-900">시안 v{draft?.versionNo}에 담김</span>}
                      </span>
                      <span className="block text-muted-foreground">
                        {negLabel(t)} 불만 {Math.round(t.complaintShare * 100)}% → {posLabel(t)} 칭찬 {Math.round(t.praiseShare * 100)}%
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {candidates.length > 0 && chosen.length === 0 && <p className="text-sm text-muted-foreground">{TEXT.pickNone}</p>}
            {chosen.length > 0 && (
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">{chosen.map((t) => APPEAL_TOPICS[t.topic].name).join(" + ")} · 소구 정리</h3>
                <div className="rounded-lg border px-4 py-3">
                  <p className="text-xs text-muted-foreground">핵심 메시지 (초안)</p>
                  <p className="mt-1 text-lg">
                    {chosen.map((t, i) => (
                      <span key={t.topic}>
                        {i > 0 && " · "}
                        {negLabel(t)} 걱정 없이 <b>{posLabel(t)}</b>
                      </span>
                    ))}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">문장은 광고 검토에서 다듬어요</p>
                </div>
                {skin.items[0] && (
                  <div className="rounded-lg border px-4 py-3">
                    <p className="text-xs text-muted-foreground">누구에게</p>
                    <p className="font-medium">{[skin.items[0]?.label, age.items[0]?.label].filter(Boolean).join(" · ")}</p>
                    <p className="text-xs text-muted-foreground">
                      고른 불만을 쓴 사람 중 {skin.items[0].label} {skin.items[0].pct}% (피부타입을 적은 {skin.known}건 기준)
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">고른 후보별 근거</p>
                  {chosen.map((t) => (
                    <div key={t.topic} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-4 py-2.5 text-sm">
                      <b className="w-20">{APPEAL_TOPICS[t.topic].name}</b>
                      <span>
                        {negLabel(t)} 불만 {t.complaints.length}건 → {posLabel(t)} 칭찬 {t.praises.length}건
                        <span className="text-muted-foreground"> · 같은 불만 {t.ownComplaints.length}건</span>
                      </span>
                      <button type="button" onClick={() => openPanel(t.topic)} className={`ml-auto ${linkClass}`}>
                        근거 리뷰 보기 →
                      </button>
                    </div>
                  ))}
                </div>
                {quotes.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">이 소구점을 뒷받침하는 우리 제품 칭찬 리뷰 (주제마다 가장 별점이 높은 리뷰 1건)</p>
                    <div className="grid gap-2 md:grid-cols-2">
                      {quotes.map((q) => (
                        <blockquote key={`${q.topic}-${q.review.id}`} className="rounded-lg border-l-2 border-foreground/30 bg-muted/40 px-4 py-2.5 text-sm">
                          “{q.review.body}”
                          <span className="mt-1 block text-xs text-muted-foreground">
                            ★ {q.review.rating}
                            {q.review.reviewer_attrs?.skin_type && ` · ${q.review.reviewer_attrs.skin_type}`}
                            {q.review.reviewer_attrs?.age_group && ` · ${q.review.reviewer_attrs.age_group}`} · {APPEAL_TOPICS[q.topic].name}
                          </span>
                        </blockquote>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
                  {draft?.reason && <p className="mr-auto text-xs text-muted-foreground">{draft.reason}</p>}
                  {draft?.canAdd && (
                    <>
                      <p className="text-xs text-muted-foreground">
                        {toAdd.length > 0 ? `고른 소구점 ${toAdd.length}개를 이 제품의 시안에 담아요` : "고른 소구점은 모두 시안에 담겨 있어요"}
                      </p>
                      <button type="button" disabled={saving || toAdd.length === 0} onClick={addToDraft} className={buttonVariants({ size: "lg" })}>
                        {saving ? "담는 중…" : "시안에 담기"}
                      </button>
                    </>
                  )}
                  {drafted.size > 0 && (
                    <Link href={`/reviews/summary?product=${data.own.id}`} className={buttonVariants({ variant: "outline", size: "lg" })}>
                      요약에서 결재 올리기 →
                    </Link>
                  )}
                  <Link href={`/ad-check/guide?product=${data.own.id}&topics=${chosen.map((t) => t.topic).join(",")}`} className={buttonVariants({ size: "lg" })}>
                    이 소구점으로 콘텐츠 만들기 →
                  </Link>
                </div>
                {notice && (
                  <p role={notice.error ? "alert" : "status"} className={`text-right text-sm ${notice.error ? "text-destructive" : "text-muted-foreground"}`}>
                    {notice.text}
                  </p>
                )}
                {draft?.canAdd && chosen.some((t) => drafted.has(t.topic)) && (
                  <p className="flex flex-wrap items-center justify-end gap-2 text-xs text-muted-foreground">
                    시안에서 빼기:
                    {chosen
                      .filter((t) => drafted.has(t.topic))
                      .map((t) => (
                        <button key={t.topic} type="button" disabled={saving} onClick={() => removeFromDraft(t.topic)} className="underline-offset-4 hover:underline disabled:opacity-50">
                          {APPEAL_TOPICS[t.topic].name}
                        </button>
                      ))}
                  </p>
                )}
              </div>
            )}
          </section>

          <section className="space-y-3 rounded-xl border bg-card p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">비교 대상</p>
                <h2 className="text-lg font-semibold">
                  Qoo10 <span lang="ja">{data.own.category}</span> 리뷰 많은 순 · 비교 제품 {data.competitors.length}개
                </h2>
                <p className="text-xs text-muted-foreground">
                  왼쪽 숫자는 Qoo10 목록의 실제 순위예요. 세트 · 여러 종류 · 다른 종류 상품은 빼서 번호가 건너뛰어요. 제품마다 별점 1~{data.maxRating}점 리뷰를 모았고,
                  리뷰가 있는 {imported.length}개 제품으로 계산했어요
                </p>
              </div>
              {focus && (
                <div role="tablist" className="flex gap-1.5">
                  {(
                    [
                      ["all", `전체 ${imported.length}`],
                      ["hit", `${negLabel(focus)} 불만 나온 제품 ${imported.filter((p) => hitCount(p.id) > 0).length}`],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={rankFilter === key}
                      onClick={() => {
                        setRankFilter(key);
                        setRankPage(1);
                      }}
                      className={`rounded-full border px-3 py-1 text-sm ${rankFilter === key ? "border-foreground font-medium" : "text-muted-foreground hover:bg-muted"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid gap-x-4 md:grid-cols-2">
              {rankPaged.rows.map((p) => {
                const hits = hitCount(p.id);
                return (
                  <Link key={p.id} href={`/reviews/${p.id}`} className="flex h-14 items-center gap-3 border-b px-1 text-sm hover:bg-muted/40">
                    <span className="w-9 text-right text-muted-foreground tabular-nums">{p.rank}위</span>
                    <span className="min-w-0 flex-1" title={titleParts(p).full}>
                      <span lang="ja" className="block truncate font-medium">
                        {titleParts(p).main}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {titleParts(p).caption ? `${titleParts(p).caption} · ` : ""}리뷰 {p.lowReviewCount}건
                      </span>
                    </span>
                    {focus && hits > 0 && (
                      <span className="rounded-md border border-orange-200 px-1.5 text-xs text-orange-900">
                        {negLabel(focus)} {hits}
                      </span>
                    )}
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
            <Pager
              page={rankPaged.page}
              pageCount={rankPaged.pageCount}
              onChange={setRankPage}
              summary={`${rankRows.length}개 중 ${rankPaged.from}~${rankPaged.to} · 순위 순`}
            />
            {notImported.length > 0 && (
              <div className="rounded-lg border border-dashed">
                <button
                  type="button"
                  aria-expanded={showEmpty}
                  onClick={() => setShowEmpty((v) => !v)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm"
                >
                  <span>
                    리뷰를 아직 안 가져온 제품 {notImported.length}개{" "}
                    <span className="text-muted-foreground">
                      · {notImported.slice(0, 3).map((p) => `${p.rank}위`).join(", ")}
                      {notImported.length > 3 && ` 외 ${notImported.length - 3}개`}
                    </span>
                  </span>
                  <span className="font-medium text-foreground/80">{showEmpty ? "접기 ⌃" : "펼치기 ⌄"}</span>
                </button>
                {showEmpty && (
                  <ul className="space-y-1 border-t px-4 py-3 text-sm text-muted-foreground">
                    {notImported.map((p) => (
                      <li key={p.id} lang="ja" title={titleParts(p).full}>
                        {p.rank}위 · {titleParts(p).main}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        </main>

        <div className="xl:sticky xl:top-4">
          <EvidencePanel open={Boolean(panelRow)} picks={1} onClose={() => setPanel(null)} title={panelRow ? APPEAL_TOPICS[panelRow.topic].name : ""}>
            {panelRow && (
              <>
                <SegmentTabs
                  items={
                    [
                      ["complaints", `경쟁 제품 불만 ${panelRow.complaints.length}`],
                      ["praises", `자사 칭찬 ${panelRow.praises.length}`],
                    ] as const
                  }
                  value={panel.tab}
                  onChange={(key) => {
                    setPanel({ topic: panelRow.topic, tab: key });
                    setShown(EVIDENCE_STEP);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  AI가 ‘{panel.tab === "complaints" ? negLabel(panelRow) : posLabel(panelRow)}’
                  {euroOf(panel.tab === "complaints" ? negLabel(panelRow) : posLabel(panelRow))} 분류한 리뷰예요. 숫자가 맞는지 확인할 때 열어 보세요.
                </p>
                {panelReviews.slice(0, shown).map((r) => (
                  <ReviewCard
                    key={r.id}
                    review={r}
                    sub={panel.tab === "complaints" ? productName(r.product_id) : undefined}
                    highlight={{ topic: panelRow.topic, polarity: panel.tab === "complaints" ? "negative" : "positive" }}
                  />
                ))}
                {panelReviews.length === 0 && <p className="text-sm text-muted-foreground">해당 리뷰가 없어요</p>}
                {panel.tab === "complaints" && panelReviews.length > shown && (
                  <button type="button" onClick={() => setShown((n) => n + EVIDENCE_STEP)} className={linkClass}>
                    더 보기 ({shown}/{panelReviews.length}) ⌄
                  </button>
                )}
                {panel.tab === "praises" && panelReviews.length > 0 && (
                  <Link href={`/reviews/${data.own.id}/list?topic=${panelRow.topic}&polarity=positive`} className={linkClass}>
                    {panelReviews.length}건 모두 원문 목록에서 보기 →
                  </Link>
                )}
                <p className="text-xs text-muted-foreground">
                  경쟁 불만 비율 {share(panelRow.complaints.length, data.lowReviewCount)}% · 자사 칭찬 비율 {share(panelRow.praises.length, data.ownReviewCount)}%
                </p>
              </>
            )}
          </EvidencePanel>
        </div>
      </div>
    </div>
  );
}
