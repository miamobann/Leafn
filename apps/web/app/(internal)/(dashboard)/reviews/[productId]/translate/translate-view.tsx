"use client";

// 상세페이지용 리뷰 (참조 F, prototype-plan P5). 고르기 → 번역 + 자동 약기법 검토 → 담당자 승인 → HTML 복사.
// 리뷰가 쌓여도 고르기 쉽게 양쪽 모두 페이지 넘기기와 "이 페이지 전체 선택"을 둔다. 승인된 리뷰만 HTML로 복사된다
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, Minus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { applySuggestion, approveTranslation, deleteTranslations, revokeApproval, translateReviews } from "@/lib/data/review-translation-actions";
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
  status: "approved" | "pending" | "fix";
  note: string;
  checkId: string | null;
  /** 대체 표현을 적용해 고친 문장이면 true */
  edited: boolean;
  /** 약기법 검토가 짚은 표현과 대체 표현 (일본어 + 한국어 뜻) */
  fixes: { text: string; reason: string; serious: boolean; suggestions: { ja: string; ko: string; pass: boolean }[] }[];
};

const PICK_PAGE = 8;
const DONE_PAGE = 6;
const TRANSLATE_BATCH = 10; // 서버 액션이 한 번에 받는 리뷰 수 (lib/data/review-translation-actions.ts와 같은 값)
const STATUS = {
  approved: { label: "승인", className: "bg-emerald-50 text-emerald-900" },
  pending: { label: "검토 대기", className: "bg-amber-50 text-amber-900" },
  fix: { label: "고쳐야 함", className: "bg-red-50 text-red-900" },
} as const;
const STEPS = [
  ["1 리뷰 고르기", "강점 리뷰가 위로"],
  ["2 번역 + 자동 약기법 검토", "번역하는 순간 같이 돌아가요"],
  ["3 고치고 팀장 승인", "대체 표현으로 고친 뒤 승인"],
  ["4 HTML 복사", "승인된 것만"],
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

function blockHtml(rows: TranslatedRow[]) {
  const esc = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return `<div class="leafn-reviews">\n${rows.map((r) => `  <blockquote lang="ja">${esc(r.textJa)}</blockquote>`).join("\n")}\n</div>`;
}

export function TranslateView({
  product,
  reviews,
  translated,
  initialPicked,
  isOwner,
}: {
  product: { id: string; name: string };
  reviews: ReviewWithAnalysis[];
  translated: TranslatedRow[];
  initialPicked: string[];
  /** 팀장(워크스페이스 owner)만 승인·승인 취소 버튼이 보인다. 서버도 같은 확인을 한다 */
  isOwner: boolean;
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
  const [status, setStatus] = useState<TranslatedRow["status"] | "">("");
  const [donePage, setDonePage] = useState(1);
  const right = usePicks();
  const [copied, setCopied] = useState<string | null>(null);
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

  const counts = { approved: 0, pending: 0, fix: 0 };
  for (const r of rows) counts[r.status] += 1;
  const shownRows = status ? rows.filter((r) => r.status === status) : rows;
  const donePaged = paginate(shownRows, donePage, DONE_PAGE);
  const approvedPicked = rows.filter((r) => right.picked.has(r.id) && r.status === "approved");

  const copyHtml = async () => {
    try {
      await navigator.clipboard.writeText(blockHtml(approvedPicked));
      setCopied(`승인된 ${approvedPicked.length}건을 HTML로 복사했어요`);
    } catch {
      setCopied("복사하지 못했어요. 브라우저의 클립보드 권한을 확인해 주세요");
    }
  };
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

  // 고른 리뷰를 10건씩 번역 + 약기법 검토한다. 끝나면 서버가 다시 읽은 목록이 오른쪽에 나타난다
  const translatePicked = async () => {
    const ids = [...left.picked];
    let done = 0;
    let mustFix = 0;
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
      setWorking({ done, total: ids.length });
    }
    setWorking(null);
    left.clear();
    setStatus("");
    setDonePage(1);
    setNotice({
      text: `${done}건을 번역하고 약기법 검토를 마쳤어요.${mustFix > 0 ? ` 고쳐야 할 표현이 있는 리뷰가 ${mustFix}건 있어요. 오른쪽 목록의 「고쳐야 함」을 확인해 주세요.` : ""}`,
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
      return { ok: true, text: res.data.mustFix ? "대체 표현을 적용해 다시 검토했어요. 아직 고쳐야 할 표현이 남아 있어요." : "대체 표현을 적용했고 약기법 검토를 다시 마쳤어요. 팀장 승인을 기다려요." };
    });
  const approve = (t: TranslatedRow) =>
    run(t.id, "승인하는 중…", async () => {
      const res = await approveTranslation(t.id);
      return res.ok ? { ok: true, text: "승인했어요. 이제 HTML로 복사할 수 있어요." } : res;
    });
  const revoke = (t: TranslatedRow) =>
    run(t.id, "승인을 취소하는 중…", async () => {
      const res = await revokeApproval(t.id);
      return res.ok ? { ok: true, text: "승인을 취소했어요. 다시 고칠 수 있어요." } : res;
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
          국내 리뷰를 골라 일본어로 번역하면 약기법 검토가 자동으로 돌아가요. 담당자가 승인한 리뷰만 상세페이지용 HTML로 복사할 수 있어요.
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
              ? "10건마다 10~20초쯤 걸려요. 끝날 때까지 이 화면을 닫거나 다른 화면으로 이동하지 마세요."
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
              {rows.length}건 · 승인 {counts.approved} · 검토 대기 {counts.pending} · 고쳐야 함 {counts.fix}
            </span>
          </div>
          <div role="tablist" className="flex flex-wrap gap-1.5">
            {(
              [
                ["", `전체 ${rows.length}`],
                ["approved", `승인 ${counts.approved}`],
                ["pending", `검토 대기 ${counts.pending}`],
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
              <button type="button" disabled={right.picked.size === 0 || working !== null} onClick={removePicked} className={buttonVariants({ variant: "outline", size: "sm" })}>
                선택 삭제
              </button>
              <button type="button" disabled={approvedPicked.length === 0} onClick={copyHtml} className={buttonVariants({ variant: "outline", size: "sm" })}>
                승인된 {approvedPicked.length}건 HTML 복사
              </button>
            </span>
          </div>
          {counts.approved > 0 && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              승인된 후기 {counts.approved}건이 있어요. 약기법 검토와 팀장 승인을 거친 일본어 후기라 콘텐츠를 만들 때 그대로 인용할 수 있어요.
              <Link href={`/ad-check/guide?product=${product.id}`} className="font-medium underline-offset-4 hover:underline">
                콘텐츠 제작 가이드 열기 →
              </Link>
            </p>
          )}
          {copied && (
            <p role="status" className="text-sm text-muted-foreground">
              {copied}
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
                    {t.status !== "approved" && t.fixes.length > 0 && (
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
                    {t.status === "pending" && (
                      <p className="pt-0.5">
                        {isOwner ? (
                          <button type="button" disabled={busy !== null} onClick={() => approve(t)} className={buttonVariants({ size: "sm" })}>
                            승인
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">팀장이 승인해요</span>
                        )}
                      </p>
                    )}
                    {t.status === "approved" && isOwner && (
                      <p className="pt-0.5">
                        <button type="button" disabled={busy !== null} onClick={() => revoke(t)} className="text-xs text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50">
                          승인 취소
                        </button>
                      </p>
                    )}
                  </div>
                  <span className={`rounded-md px-2 py-0.5 text-xs whitespace-nowrap ${STATUS[t.status].className}`}>{STATUS[t.status].label}</span>
                </li>
              );
            })}
            {donePaged.rows.length === 0 && <li className="py-4 text-center text-sm text-muted-foreground">번역한 리뷰가 없어요</li>}
          </ul>
          <Pager page={donePaged.page} pageCount={donePaged.pageCount} onChange={setDonePage} summary={`${shownRows.length}건 중 ${donePaged.from}~${donePaged.to}`} />
          <p className="text-xs text-muted-foreground">
            고쳐야 할 표현은 「이렇게 고치기」로 바로 바꿔요. 바꾸면 다시 번역하고 약기법 검토가 한 번 더 돌아가요. 승인은 팀장(owner)이 하고, 승인 전인 리뷰는 HTML 복사에서 빠져요. 승인은 광고 검토 이력에도 「내부 검토 완료」로 남아요. 선택 삭제를 해도 약기법 검토 기록은 광고 검토 이력에 남아요. 법률 자문이 아닌 검토 보조 결과이며 최종 판단은 담당자·전문가가 해요.
          </p>
        </section>
      </div>
    </div>
  );
}
