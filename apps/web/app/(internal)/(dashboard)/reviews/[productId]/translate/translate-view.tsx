"use client";

// 상세페이지용 리뷰 (참조 F, prototype-plan P5). 고르기 → 번역 + 자동 약기법 검토 → 고치기 → 시안에 담기 → (요약 탭에서) 팀장 결재 → 콘텐츠 제작 가이드.
// 리뷰가 쌓여도 고르기 쉽게 양쪽 모두 페이지 넘기기와 "이 페이지 전체 선택"을 둔다. 문구마다 승인하지 않고, 담은 후기를 시안 하나로 묶어 팀장이 결재한다.
// 결재된 시안에 담긴 후기만 콘텐츠 제작 가이드의 후기 재료가 된다
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, Minus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { applySuggestion, deleteTranslations, translateReviews } from "@/lib/data/review-translation-actions";
import { addToReviewDraft, removeFromReviewDraft } from "@/lib/data/submission-actions";
import type { ReviewWithAnalysis } from "@/lib/data/reviews";
import type { AppealTopic } from "@/lib/schemas/review";
import { BackTitle, paginate, Pager } from "../../_components/parts";
import { hasTopic, topicLabel, topicStats } from "../../_lib/topics";
import { readTranslatePicks, writeTranslatePicks } from "../../_lib/translate-picks";

export type TranslatedRow = {
  id: string;
  reviewId: string;
  textJa: string;
  textKo: string;
  /** ready = 약기법 검토 통과(담을 수 있음) · fix = 고쳐야 함(고치기 전에는 담을 수 없음) */
  status: "ready" | "fix";
  /** 이 제품의 리뷰 분석 시안에 이미 담겼는가 */
  drafted: boolean;
  note: string;
  checkId: string | null;
  /** 대체 표현을 적용해 고친 문장이면 true */
  edited: boolean;
  /** 약기법 검토가 짚은 표현과 대체 표현 (일본어 + 한국어 뜻) */
  fixes: { text: string; reason: string; serious: boolean; suggestions: { ja: string; ko: string; pass: boolean }[] }[];
};

const PICK_PAGE = 8;
const DONE_PAGE = 6;
const TRANSLATE_BATCH = 5; // 서버 액션이 한 번에 받는 리뷰 수 (lib/data/review-translation-actions.ts와 같은 값)
type RowKind = "added" | "ready" | "fix";
const STATUS: Record<RowKind, { label: string; className: string }> = {
  added: { label: "시안에 담김", className: "bg-emerald-50 text-emerald-900" },
  ready: { label: "검토 통과", className: "bg-amber-50 text-amber-900" },
  fix: { label: "고쳐야 함", className: "bg-red-50 text-red-900" },
};
const kindOf = (r: TranslatedRow): RowKind => (r.drafted ? "added" : r.status);
const STEPS = [
  ["1 리뷰 고르기", "강점 리뷰가 위로"],
  ["2 번역 + 자동 약기법 검토", "번역하는 순간 같이 돌아가요"],
  ["3 대체 표현으로 고치기", "고쳐야 함은 고친 뒤에 담아요"],
  ["4 시안에 담기", "요약 탭에서 팀장 결재"],
] as const;
const selectClass = "h-9 rounded-md border bg-background px-2 text-sm";

function Box({ state }: { state: "on" | "off" | "some" }) {
  return (
    <span
      aria-hidden
      className={`flex size-[18px] flex-none items-center justify-center rounded border ${state === "off" ? "border-stone-400 bg-background" : "border-foreground bg-foreground text-background"}`}
    >
      {state === "on" && <Check className="size-3" />}
      {state === "some" && <Minus className="size-3" />}
    </span>
  );
}

function usePicks(initial: string[] = []) {
  const [picked, setPicked] = useState<Set<string>>(new Set(initial));
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const setMany = (ids: string[], on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  return { picked, toggle, setMany, clear: () => setPicked(new Set()) };
}

function PageToggle({ ids, picked, setMany, count }: { ids: string[]; picked: Set<string>; setMany: (ids: string[], on: boolean) => void; count: number }) {
  const onPage = ids.filter((id) => picked.has(id)).length;
  const state = onPage === 0 ? "off" : onPage === ids.length ? "on" : "some";
  return (
    <button type="button" onClick={() => setMany(ids, state !== "on")} className="flex items-center gap-2 text-sm" disabled={ids.length === 0}>
      <Box state={state} />
      이 페이지 전체 선택 <span className="text-muted-foreground">· {count}개 선택</span>
    </button>
  );
}

export function TranslateView({
  product,
  reviews,
  translated,
  initialPicked,
  draft,
}: {
  product: { id: string; name: string };
  reviews: ReviewWithAnalysis[];
  translated: TranslatedRow[];
  initialPicked: string[];
  /** 리뷰 분석 시안의 지금 상태. canAdd가 false면 「시안에 담기」를 숨기고 reason을 보인다 */
  draft: { canAdd: boolean; reason: string | null; versionNo: number | null; draftStatus: string | null; count: number };
}) {
  const stats = topicStats(reviews).filter((s) => s.pos.length > 0).toSorted((a, b) => b.pos.length - a.pos.length);
  const [topic, setTopic] = useState<AppealTopic | "">("");
  const [skin, setSkin] = useState("");
  const [highOnly, setHighOnly] = useState(true);
  const [pickPage, setPickPage] = useState(1);
  const left = usePicks(initialPicked);
  // 리포트에서 [상세페이지용으로 담기]로 담아 둔 리뷰를 처음 열 때 미리 체크하고, 이후 체크는 다시 담은 목록으로 남긴다
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const ids = new Set(reviews.map((r) => r.id));
    left.setMany(readTranslatePicks(product.id).filter((id) => ids.has(id)), true);
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 화면을 처음 열 때 한 번만
  }, []);
  useEffect(() => {
    if (loaded) writeTranslatePicks(product.id, [...left.picked]);
  }, [loaded, left.picked, product.id]);

  const router = useRouter();
  // 번역한 리뷰는 서버가 읽어 준 목록(translated)이 기준이다. 지운 것만 화면에서 먼저 뺀다
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const rows = translated.filter((r) => !removed.has(r.id));
  const [status, setStatus] = useState<RowKind | "">("");
  const [donePage, setDonePage] = useState(1);
  const right = usePicks();
  const [working, setWorking] = useState<{ done: number; total: number } | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  const translatedIds = new Set(rows.map((r) => r.reviewId));
  const skins = [...new Set(reviews.flatMap((r) => (r.reviewer_attrs?.skin_type ? [r.reviewer_attrs.skin_type] : [])))];
  // 강점 리뷰가 위로: 고른 주제(없으면 아무 강점)의 칭찬이 있는 리뷰 → 별점 → 최근
  const strengthScore = (r: ReviewWithAnalysis) => (topic ? Number(hasTopic(r, topic, "positive")) : Number(stats.some((s) => hasTopic(r, s.topic, "positive"))));
  const candidates = useMemo(
    () =>
      reviews
        .filter((r) => !topic || hasTopic(r, topic, "positive"))
        .filter((r) => !skin || r.reviewer_attrs?.skin_type === skin)
        .filter((r) => !highOnly || r.rating >= 4)
        .toSorted((a, b) => Number(initialPicked.includes(b.id)) - Number(initialPicked.includes(a.id)) || strengthScore(b) - strengthScore(a) || b.rating - a.rating || b.posted_at.localeCompare(a.posted_at)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- strengthScore는 topic · stats로만 바뀐다
    [reviews, topic, skin, highOnly, initialPicked],
  );
  const pickPaged = paginate(candidates, pickPage, PICK_PAGE);

  const counts = { added: 0, ready: 0, fix: 0 };
  for (const r of rows) counts[kindOf(r)] += 1;
  const shownRows = status ? rows.filter((r) => kindOf(r) === status) : rows;
  // 고른 번역 중 지금 시안에 담을 수 있는 것: 이미 담았거나 고쳐야 하는 것은 뺀다
  const addable = rows.filter((r) => right.picked.has(r.id) && r.status === "ready" && !r.drafted);
  const pickedFix = rows.filter((r) => right.picked.has(r.id) && r.status === "fix").length;
  const donePaged = paginate(shownRows, donePage, DONE_PAGE);
  const removePicked = async () => {
    const ids = [...right.picked];
    const res = await deleteTranslations(ids);
    if (!res.ok) {
      setNotice({ text: res.message, error: true });
      return;
    }
    setRemoved((prev) => new Set([...prev, ...ids]));
    right.clear();
    setDonePage(1);
    setNotice({ text: `${res.data.deleted}건을 지웠어요. 약기법 검토 기록은 광고 검토 이력에 남아요.`, error: false });
    router.refresh();
  };

  // 고른 리뷰를 5건씩 번역 + 약기법 검토한다. 끝나면 서버가 다시 읽은 목록이 오른쪽에 나타난다
  const translatePicked = async () => {
    const ids = [...left.picked];
    let done = 0;
    let mustFix = 0;
    let skipped = 0;
    setNotice(null);
    setWorking({ done, total: ids.length });
    for (let i = 0; i < ids.length; i += TRANSLATE_BATCH) {
      const chunk = ids.slice(i, i + TRANSLATE_BATCH);
      const res = await translateReviews(product.id, chunk);
      if (!res.ok) {
        setWorking(null);
        setNotice({ text: `${res.message}${done > 0 ? ` (앞의 ${done}건은 번역됐어요)` : ""}`, error: true });
        router.refresh();
        return;
      }
      done += res.data.translated;
      mustFix += res.data.mustFix;
      skipped += res.data.skipped;
      setWorking({ done: done + skipped, total: ids.length });
    }
    setWorking(null);
    left.clear();
    setStatus("");
    setDonePage(1);
    setNotice({
      text: `${done}건을 번역하고 약기법 검토를 마쳤어요.${mustFix > 0 ? ` 고쳐야 할 표현이 있는 리뷰가 ${mustFix}건 있어요. 오른쪽 목록의 「고쳐야 함」을 확인해 주세요.` : ""}${skipped > 0 ? ` ${skipped}건은 AI가 형식에 맞는 답을 주지 않아 건너뛰었어요. 다시 골라 번역해 보세요.` : ""}`,
      error: false,
    });
    router.refresh();
  };
  // 대체 표현 적용 · 승인 · 승인 취소: 한 번에 한 건만 (다시 번역 + 약기법 검토가 돌아서 몇 초 걸린다)
  const [busy, setBusy] = useState<{ id: string; label: string } | null>(null);
  const run = async (id: string, label: string, job: () => Promise<{ ok: true; text: string } | { ok: false; message: string }>) => {
    setBusy({ id, label });
    setNotice(null);
    const res = await job();
    setBusy(null);
    setNotice(res.ok ? { text: res.text, error: false } : { text: res.message, error: true });
    router.refresh();
  };
  const applyFix = (t: TranslatedRow, finding: string, suggestionJa: string) =>
    run(t.id, "고쳐서 다시 번역하고 약기법 검토하는 중…", async () => {
      const res = await applySuggestion(t.id, finding, suggestionJa);
      if (!res.ok) return res;
      return { ok: true, text: res.data.mustFix ? "대체 표현을 적용해 다시 검토했어요. 아직 고쳐야 할 표현이 남아 있어요." : "대체 표현을 적용했고 약기법 검토를 다시 마쳤어요. 이제 시안에 담을 수 있어요." };
    });
  const addPicked = () =>
    run("add", "시안에 담는 중…", async () => {
      const res = await addToReviewDraft(product.id, { translationIds: addable.map((r) => r.id) });
      if (!res.ok) return res;
      right.clear();
      return { ok: true, text: `${addable.length}건을 시안 v${res.data.versionNo}에 담았어요. 요약 탭에서 한 줄 결론을 쓰고 결재를 올려 주세요.` };
    });
  const removeOne = (t: TranslatedRow) =>
    run(t.id, "시안에서 빼는 중…", async () => {
      const res = await removeFromReviewDraft(product.id, { translationId: t.id });
      return res.ok ? { ok: true, text: `시안 v${res.data.versionNo}에서 뺐어요.` } : res;
    });
  const changeLeft = (fn: () => void) => {
    fn();
    setPickPage(1);
  };

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <BackTitle href={`/reviews/${product.id}`} title={`상세페이지용 리뷰 · ${product.name.replace(/^Leaf& Dew /, "")}`} />
        <p className="pl-8 text-sm text-muted-foreground">
          국내 리뷰를 골라 일본어로 번역하면 약기법 검토가 자동으로 돌아가요. 고쳐서 시안에 담으면 팀장이 시안을 결재하고, 결재된 후기만 콘텐츠 제작 가이드에서 인용할 수 있어요.
        </p>
      </header>

      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(([title, sub]) => (
          <li key={title} className="rounded-lg border bg-card px-4 py-2.5 text-sm">
            <b>{title}</b>
            <span className="block text-xs text-muted-foreground">{sub}</span>
          </li>
        ))}
      </ol>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <section className="space-y-3 rounded-xl border bg-card p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-semibold">국내 리뷰 고르기</h2>
            <span className="text-sm text-muted-foreground">{candidates.length}건</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <select aria-label="강점 주제" className={selectClass} value={topic} onChange={(e) => changeLeft(() => setTopic(e.target.value as AppealTopic | ""))}>
              <option value="">전체 리뷰</option>
              {stats.map((s) => (
                <option key={s.topic} value={s.topic}>
                  강점: {topicLabel(s.topic, "positive")}
                </option>
              ))}
            </select>
            <select aria-label="피부타입" className={selectClass} value={skin} onChange={(e) => changeLeft(() => setSkin(e.target.value))}>
              <option value="">피부타입 전체</option>
              {skins.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select aria-label="별점" className={selectClass} value={highOnly ? "high" : ""} onChange={(e) => changeLeft(() => setHighOnly(e.target.value === "high"))}>
              <option value="high">별점 4~5</option>
              <option value="">별점 전체</option>
            </select>
          </div>
          <div className="flex items-center justify-between gap-2 border-y py-2">
            <PageToggle ids={pickPaged.rows.map((r) => r.id)} picked={left.picked} setMany={left.setMany} count={left.picked.size} />
            {left.picked.size > 0 && (
              <button type="button" onClick={left.clear} className="text-sm text-muted-foreground hover:underline">
                선택 해제
              </button>
            )}
          </div>
          <ul className="space-y-1">
            {pickPaged.rows.map((r) => {
              const on = left.picked.has(r.id);
              const strength = stats.find((s) => hasTopic(r, s.topic, "positive"));
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => left.toggle(r.id)}
                    className={`flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted/50 ${on ? "bg-muted/40" : ""}`}
                  >
                    <Box state={on ? "on" : "off"} />
                    <span className="min-w-0 flex-1">
                      <span className="block">{r.body}</span>
                      <span className="text-xs text-muted-foreground">
                        {[`★${r.rating}`, r.reviewer_attrs?.skin_type, r.reviewer_attrs?.age_group, strength && topicLabel(strength.topic, "positive")].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    {translatedIds.has(r.id) && <span className="rounded-md border px-1.5 text-xs text-muted-foreground">번역함</span>}
                  </button>
                </li>
              );
            })}
            {pickPaged.rows.length === 0 && <li className="py-4 text-center text-sm text-muted-foreground">조건에 맞는 리뷰가 없어요</li>}
          </ul>
          <Pager page={pickPaged.page} pageCount={pickPaged.pageCount} onChange={setPickPage} summary={`${candidates.length}건 중 ${pickPaged.from}~${pickPaged.to}`} />
          <button
            type="button"
            disabled={left.picked.size === 0 || working !== null}
            onClick={translatePicked}
            className={`${buttonVariants({ size: "lg" })} w-full`}
          >
            {working ? `번역하는 중… ${working.done} / ${working.total}건` : `선택한 ${left.picked.size}건 일본어로 번역하기`}
          </button>
          <p className="text-xs text-muted-foreground">
            {working
              ? "5건마다 10~20초쯤 걸려요. 끝날 때까지 이 화면을 닫거나 다른 화면으로 이동하지 마세요."
              : "번역하면 약기법 검토가 함께 돌아가고, 결과가 오른쪽 목록에 쌓여요. 이미 번역한 리뷰를 다시 고르면 새로 번역해요."}
          </p>
          {notice && (
            <p role={notice.error ? "alert" : "status"} className={`text-sm ${notice.error ? "text-destructive" : "text-muted-foreground"}`}>
              {notice.text}
            </p>
          )}
        </section>

        <section className="space-y-3 rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">번역한 리뷰</h2>
            <span className="text-sm text-muted-foreground">
              {rows.length}건 · 시안에 담김 {counts.added} · 검토 통과 {counts.ready} · 고쳐야 함 {counts.fix}
            </span>
          </div>
          <div role="tablist" className="flex flex-wrap gap-1.5">
            {(
              [
                ["", `전체 ${rows.length}`],
                ["added", `담김 ${counts.added}`],
                ["ready", `검토 통과 ${counts.ready}`],
                ["fix", `고쳐야 함 ${counts.fix}`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={status === key}
                onClick={() => {
                  setStatus(key);
                  setDonePage(1);
                }}
                className={`rounded-full border px-3 py-1 text-sm ${status === key ? "border-foreground font-medium" : "text-muted-foreground hover:bg-muted"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-y py-2">
            <PageToggle ids={donePaged.rows.map((r) => r.id)} picked={right.picked} setMany={right.setMany} count={right.picked.size} />
            <span className="flex gap-2">
              {draft.canAdd && (
                <button type="button" disabled={addable.length === 0 || working !== null || busy !== null} onClick={addPicked} className={buttonVariants({ size: "sm" })}>
                  시안에 담기 {addable.length > 0 && `(${addable.length}건)`}
                </button>
              )}
              <button type="button" disabled={right.picked.size === 0 || working !== null} onClick={removePicked} className={buttonVariants({ variant: "outline", size: "sm" })}>
                선택 삭제
              </button>
            </span>
          </div>
          {pickedFix > 0 && draft.canAdd && <p className="text-xs text-muted-foreground">고쳐야 함 {pickedFix}건은 담기에서 빠져요. 「이렇게 고치기」로 고친 뒤 담아 주세요.</p>}
          {draft.reason && <p className="text-xs text-muted-foreground">{draft.reason}</p>}
          {draft.count > 0 && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              시안 v{draft.versionNo}에 일본어 후기 {draft.count}건이 담겨 있어요. 요약 탭에서 한 줄 결론을 쓰고 결재를 올리면 팀장이 한 번에 승인해요.
              <Link href="/reviews/summary" className="font-medium underline-offset-4 hover:underline">
                요약으로 가기 →
              </Link>
            </p>
          )}
          <ul className="space-y-1">
            {donePaged.rows.map((t) => {
              const on = right.picked.has(t.id);
              return (
                <li key={t.id} className={`flex items-start gap-3 rounded-lg px-2 py-2 text-sm ${on ? "bg-muted/40" : ""}`}>
                  <button type="button" role="checkbox" aria-checked={on} aria-label="이 번역 선택" onClick={() => right.toggle(t.id)} className="mt-0.5">
                    <Box state={on ? "on" : "off"} />
                  </button>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p lang="ja">{t.textJa}</p>
                    <p className="text-muted-foreground">
                      {t.textKo}
                      {t.edited && <span className="ml-1.5 rounded bg-stone-100 px-1.5 py-0.5 text-xs">고침</span>}
                    </p>
                    {t.note &&
                      (t.checkId ? (
                        <Link href={`/ad-check/${t.checkId}`} className={`block text-xs hover:underline ${t.status === "fix" ? "text-orange-800" : "text-muted-foreground"}`}>
                          {t.note} →
                        </Link>
                      ) : (
                        <p className="text-xs text-muted-foreground">{t.note}</p>
                      ))}
                    {t.status === "fix" && t.fixes.length > 0 && (
                      <ul className="mt-1.5 space-y-2 rounded-md border bg-muted/30 p-2.5">
                        {t.fixes.map((f) => (
                          <li key={f.text} className="space-y-1">
                            <p className="text-xs">
                              <b className={f.serious ? "text-orange-800" : ""}>「{f.text}」</b> <span className="text-muted-foreground">{f.reason}</span>
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {f.suggestions.map((s) => (
                                <button
                                  key={s.ja}
                                  type="button"
                                  disabled={busy !== null}
                                  onClick={() => applyFix(t, f.text, s.ja)}
                                  className="rounded-md border bg-background px-2 py-1 text-left text-xs hover:bg-muted disabled:opacity-50"
                                >
                                  <span className="font-medium">이렇게 고치기</span> · {s.ko}
                                  <span lang="ja" className="block text-muted-foreground">
                                    {s.ja}
                                  </span>
                                  {!s.pass && <span className="block text-amber-800">이 안도 다시 손볼 부분이 있어요</span>}
                                </button>
                              ))}
                              {f.suggestions.length === 0 && <span className="text-xs text-muted-foreground">대체 표현이 없어요. 광고 검토 화면에서 직접 고쳐 주세요.</span>}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    {busy?.id === t.id && (
                      <p role="status" className="text-xs text-muted-foreground">
                        {busy.label}
                      </p>
                    )}
                    {t.drafted && draft.canAdd && (
                      <p className="pt-0.5">
                        <button type="button" disabled={busy !== null} onClick={() => removeOne(t)} className="text-xs text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50">
                          시안에서 빼기
                        </button>
                      </p>
                    )}
                  </div>
                  <span className={`rounded-md px-2 py-0.5 text-xs whitespace-nowrap ${STATUS[kindOf(t)].className}`}>{STATUS[kindOf(t)].label}</span>
                </li>
              );
            })}
            {donePaged.rows.length === 0 && <li className="py-4 text-center text-sm text-muted-foreground">번역한 리뷰가 없어요</li>}
          </ul>
          <Pager page={donePaged.page} pageCount={donePaged.pageCount} onChange={setDonePage} summary={`${shownRows.length}건 중 ${donePaged.from}~${donePaged.to}`} />
          <p className="text-xs text-muted-foreground">
            고쳐야 할 표현은 「이렇게 고치기」로 바로 바꿔요. 바꾸면 다시 번역하고 약기법 검토가 한 번 더 돌아가요. 문구마다 승인하지 않고, 시안에 담은 후기를 팀장이 시안 단위로 결재해요. 선택 삭제를 해도 약기법 검토 기록은 광고 검토 이력에 남아요. 법률 자문이 아닌 검토 보조 결과이며 최종 판단은 담당자·전문가가 해요.
          </p>
        </section>
      </div>
    </div>
  );
}
