"use client";

// 상세페이지용 리뷰 (참조 F, prototype-plan P5). 고르기 → 번역 + 자동 약기법 검토 → 담당자 승인 → HTML 복사.
// 리뷰가 쌓여도 고르기 쉽게 양쪽 모두 페이지 넘기기와 "이 페이지 전체 선택"을 둔다. 승인된 리뷰만 HTML로 복사된다
import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, Minus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { ReviewWithAnalysis } from "@/lib/data/reviews";
import type { AppealTopic } from "@/lib/schemas/review";
import { BackTitle, paginate, Pager } from "../../_components/parts";
import { hasTopic, topicLabel, topicStats } from "../../_lib/topics";

export type TranslatedRow = {
  id: string;
  reviewId: string;
  textJa: string;
  textKo: string;
  status: "approved" | "pending" | "fix";
  note: string;
  checkId: string | null;
};

const PICK_PAGE = 8;
const DONE_PAGE = 6;
const STATUS = {
  approved: { label: "승인", className: "bg-emerald-50 text-emerald-900" },
  pending: { label: "검토 대기", className: "bg-amber-50 text-amber-900" },
  fix: { label: "고쳐야 함", className: "bg-red-50 text-red-900" },
} as const;
const STEPS = [
  ["1 리뷰 고르기", "강점 리뷰가 위로"],
  ["2 번역 + 자동 약기법 검토", "번역하는 순간 같이 돌아가요"],
  ["3 담당자 승인", "위험 표현은 고친 뒤 승인"],
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
}: {
  product: { id: string; name: string };
  reviews: ReviewWithAnalysis[];
  translated: TranslatedRow[];
  initialPicked: string[];
}) {
  const stats = topicStats(reviews).filter((s) => s.pos.length > 0).toSorted((a, b) => b.pos.length - a.pos.length);
  const [topic, setTopic] = useState<AppealTopic | "">("");
  const [skin, setSkin] = useState("");
  const [highOnly, setHighOnly] = useState(true);
  const [pickPage, setPickPage] = useState(1);
  const left = usePicks(initialPicked);

  const [rows, setRows] = useState(translated);
  const [status, setStatus] = useState<TranslatedRow["status"] | "">("");
  const [donePage, setDonePage] = useState(1);
  const right = usePicks();
  const [copied, setCopied] = useState<string | null>(null);

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
  const removePicked = () => {
    setRows((prev) => prev.filter((r) => !right.picked.has(r.id)));
    right.clear();
    setDonePage(1);
  };
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
          {/* 번역 API(POST /api/reviews/translate)는 P5 실데이터 연동 때 붙인다. 지금은 버튼만 */}
          <button type="button" disabled title="번역 연결 전이에요" className={`${buttonVariants({ size: "lg" })} w-full`}>
            선택한 {left.picked.size}건 일본어로 번역하기
          </button>
          <p className="text-xs text-muted-foreground">번역이 끝나면 약기법 검토가 자동으로 실행되고, 오른쪽 목록에 쌓여요. (번역 연결 전)</p>
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
              <button type="button" disabled={right.picked.size === 0} onClick={removePicked} className={buttonVariants({ variant: "outline", size: "sm" })}>
                선택 삭제
              </button>
              <button type="button" disabled={approvedPicked.length === 0} onClick={copyHtml} className={buttonVariants({ variant: "outline", size: "sm" })}>
                승인된 {approvedPicked.length}건 HTML 복사
              </button>
            </span>
          </div>
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
                    <p className="text-muted-foreground">{t.textKo}</p>
                    {t.note &&
                      (t.checkId ? (
                        <Link href={`/ad-check/${t.checkId}`} className={`block text-xs hover:underline ${t.status === "fix" ? "text-orange-800" : "text-muted-foreground"}`}>
                          {t.note} →
                        </Link>
                      ) : (
                        <p className="text-xs text-muted-foreground">{t.note}</p>
                      ))}
                  </div>
                  <span className={`rounded-md px-2 py-0.5 text-xs whitespace-nowrap ${STATUS[t.status].className}`}>{STATUS[t.status].label}</span>
                </li>
              );
            })}
            {donePaged.rows.length === 0 && <li className="py-4 text-center text-sm text-muted-foreground">번역한 리뷰가 없어요</li>}
          </ul>
          <Pager page={donePaged.page} pageCount={donePaged.pageCount} onChange={setDonePage} summary={`${shownRows.length}건 중 ${donePaged.from}~${donePaged.to}`} />
          <p className="text-xs text-muted-foreground">
            승인 전인 리뷰가 섞여 있으면 HTML 복사에서 빠져요. 선택 삭제는 아직 저장되지 않아요. 법률 자문이 아닌 검토 보조 결과이며 최종 판단은 담당자·전문가가 해요.
          </p>
        </section>
      </div>
    </div>
  );
}
