"use client";

// 리뷰 리포트 (자사 · 경쟁). 머리 → 한 줄 결론 + 숫자 4개 → 강점/약점(자사) 또는 불만 TOP3 → 우리 제품(경쟁) → 6개 주제별 칭찬 · 불만.
// 항목을 누르면 그 항목의 근거 리뷰만 오른쪽 패널에 열린다 (좁은 화면에서는 서랍)
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { ReviewProductView, ReviewWithAnalysis } from "@/lib/data/reviews";
import { euroOf, yoOf } from "@/lib/korean";
import { titleParts } from "@/lib/product-title";
import { APPEAL_TOPICS, type AppealTopic } from "@/lib/schemas/review";
import { BackTitle, Chip, EvidencePanel, linkClass, Meter, ReviewCard, SortChips, sortReviews } from "../_components/parts";
import {
  average,
  distribution,
  latestDate,
  type Polarity,
  periodOf,
  ratingCounts,
  share,
  SKIN_LINE_LABEL,
  STRENGTH_RULE,
  topicLabel,
  topicStats,
  topThree,
  VERDICT_LABEL,
  verdictOf,
} from "../_lib/topics";

type Product = ReviewProductView & { platformLabel: string };
type OwnCompare = { id: string; name: string; reviews: ReviewWithAnalysis[] } | null;
/** polarity "all" = 주제 카드를 눌렀을 때: 그 주제의 칭찬과 불만을 함께 연다 */
type Selected = { topic: AppealTopic; polarity: Polarity | "all" } | null;

const SOURCE_LABEL: Record<string, string> = { oliveyoung: "올리브영", qoo10: "Qoo10", rakuten: "라쿠텐", cosme: "@cosme", csv: "CSV" };
const EVIDENCE_PREVIEW = 3;

export function ReportView({
  product,
  reviews,
  ownCompare,
  options,
}: {
  product: Product;
  reviews: ReviewWithAnalysis[];
  ownCompare: OwnCompare;
  options: { id: string; label: string }[];
}) {
  const router = useRouter();
  const isOwn = product.kind === "own";
  const productTitle = titleParts({ brand: product.brand, name: product.name, title_ai: product.titleAi });
  const stats = topicStats(reviews);
  const analyzedCount = reviews.filter((r) => r.analysis).length;
  const strengths = topThree(stats, "positive");
  const weaknesses = topThree(stats, "negative");
  const first: Selected = isOwn
    ? strengths[0] && { topic: strengths[0].topic, polarity: "positive" }
    : weaknesses[0] && { topic: weaknesses[0].topic, polarity: "negative" };
  const [selected, setSelected] = useState<Selected>(first ?? null);
  const [sort, setSort] = useState<"recent" | "rating">("recent");
  const [picks, setPicks] = useState(0);

  const sources = [...new Set(reviews.map((r) => SOURCE_LABEL[r.source] ?? r.source))].join(" · ");
  const meta = [
    `${isOwn ? "국내" : "일본"} 리뷰 ${reviews.length}건`,
    sources,
    periodOf(reviews),
    `분석 완료 ${analyzedCount}/${reviews.length}`,
    latestDate(reviews) && `마지막 수집 ${latestDate(reviews)?.slice(5)}`,
  ].filter(Boolean);
  const lowOnly = reviews.length > 0 && reviews.every((r) => r.rating <= 3);

  const selectedStat = selected && stats.find((s) => s.topic === selected.topic);
  const evidenceOf = (polarity: Polarity) => (selectedStat ? sortReviews(polarity === "positive" ? selectedStat.pos : selectedStat.neg, sort) : []);
  const shownPolarities: Polarity[] = !selected ? [] : selected.polarity === "all" ? ["positive", "negative"] : [selected.polarity];
  const evidenceCount = shownPolarities.reduce((n, p) => n + evidenceOf(p).length, 0);
  const listHref = (topic: AppealTopic, polarity: Polarity) => `/reviews/${product.id}/list?topic=${topic}&polarity=${polarity}`;
  const pick = (topic: AppealTopic, polarity: Polarity | "all") => {
    setSelected({ topic, polarity });
    setPicks((n) => n + 1);
  };
  const isActive = (topic: AppealTopic, polarity: Polarity) => selected?.topic === topic && (selected.polarity === "all" || selected.polarity === polarity);

  // 경쟁 리포트: 이 제품의 불만 TOP3 주제에서 우리 제품의 국내 반응
  const ownStats = ownCompare ? topicStats(ownCompare.reviews) : [];
  const gaps = weaknesses.map((w) => {
    const mine = ownStats.find((s) => s.topic === w.topic);
    return { ...w, ownPos: mine?.pos.length ?? 0, ownNeg: mine?.neg.length ?? 0, candidate: mine ? verdictOf(mine) === "strength" : false };
  });
  const gapCandidates = gaps.filter((g) => g.candidate);
  const praised = stats.filter((s) => s.pos.length > 0).toSorted((a, b) => b.pos.length - a.pos.length);

  const skin = distribution(reviews, (r) => r.reviewer_attrs?.skin_type);
  const age = distribution(reviews, (r) => r.reviewer_attrs?.age_group);
  const ratings = ratingCounts(reviews);
  const positive = reviews.filter((r) => r.analysis?.sentiment === "positive").length;
  const neutral = reviews.filter((r) => r.analysis?.sentiment === "neutral").length;
  const repurchase = reviews.filter((r) => (r.analysis?.repurchase_factors.length ?? 0) > 0).length;
  const irritation = stats.find((s) => s.topic === "irritation")?.neg.length ?? 0;

  const metrics = isOwn
    ? [
        { label: "평균 평점", value: average(reviews.map((r) => r.rating)) ?? "—", sub: "5점 만점" },
        { label: "긍정 리뷰", value: `${share(positive, analyzedCount)}%`, sub: `중립 ${share(neutral, analyzedCount)}% · 부정 ${share(analyzedCount - positive - neutral, analyzedCount)}%` },
        { label: "재구매 요인 언급", value: `${share(repurchase, analyzedCount)}%`, sub: `${analyzedCount}건 중 ${repurchase}건` },
        { label: "가장 큰 만족", value: strengths[0] ? topicLabel(strengths[0].topic, "positive") : "없음", sub: strengths[0] ? `${analyzedCount}건 중 ${strengths[0].count}건` : "" },
      ]
    : [
        { label: "가장 큰 불만", value: weaknesses[0] ? topicLabel(weaknesses[0].topic, "negative") : "없음", sub: weaknesses[0] ? `${reviews.length}건 중 ${weaknesses[0].count}건` : "" },
        { label: "우리 강점과 겹치는 불만", value: `${gapCandidates.length}개`, sub: gapCandidates.map((g) => topicLabel(g.topic, "negative")).join(" · ") || (ownCompare ? "없음" : "비교할 우리 제품 없음") },
        { label: "피부 반응 언급", value: `${irritation}건`, sub: "자극 불만" },
        { label: "수집한 리뷰 평균", value: average(reviews.map((r) => r.rating)) ?? "—", sub: lowOnly ? "1~3점만 수집" : "5점 만점" },
      ];

  const conclusion = isOwn
    ? strengths[0] ? (
        <>
          국내 고객이 가장 많이 칭찬한 점은 <b>‘{topicLabel(strengths[0].topic, "positive")}’</b>
          {weaknesses[0] ? (
            <>
              이고, 가장 큰 불만은 <b>‘{topicLabel(weaknesses[0].topic, "negative")}’</b>
              {yoOf(topicLabel(weaknesses[0].topic, "negative"))}.
            </>
          ) : (
            "이에요. 눈에 띄는 불만은 없어요."
          )}
        </>
      ) : (
        weaknesses[0] && (
          <>
            뚜렷하게 칭찬받은 주제는 아직 없어요. 가장 큰 불만은 <b>‘{topicLabel(weaknesses[0].topic, "negative")}’</b>
            {yoOf(topicLabel(weaknesses[0].topic, "negative"))}.
          </>
        )
      )
    : weaknesses[0] && (
        <>
          일본 소비자가 이 제품에서 가장 많이 말한 불만은 <b>‘{topicLabel(weaknesses[0].topic, "negative")}’</b>
          {yoOf(topicLabel(weaknesses[0].topic, "negative"))}.
          {gapCandidates[0] && (
            <>
              {" "}
              우리 제품이 칭찬받는 <b>‘{topicLabel(gapCandidates[0].topic, "positive")}’</b>
              {euroOf(topicLabel(gapCandidates[0].topic, "positive"))} 채울 수 있어요.
            </>
          )}
        </>
      );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <BackTitle href="/reviews" title={isOwn ? product.name : productTitle.main}>
            <Chip>{isOwn ? "자사" : "경쟁"}</Chip>
            {isOwn && product.skinLine && <Chip>{SKIN_LINE_LABEL[product.skinLine]}</Chip>}
            {!isOwn && product.rank && (
              <Chip>
                {product.platformLabel} <span lang="ja">{product.category}</span> {product.rank}위
              </Chip>
            )}
          </BackTitle>
          {!isOwn && productTitle.caption && <p className="pl-8 text-base">{productTitle.caption}</p>}
          {!isOwn && productTitle.cleaned && (
            <details className="pl-8 text-xs text-muted-foreground">
              <summary className="cursor-pointer underline-offset-4 hover:underline">원문 제품명 보기</summary>
              <p lang="ja" className="mt-1">
                {productTitle.full}
              </p>
            </details>
          )}
          <p className="pl-8 text-sm text-muted-foreground">{meta.join(" · ")}</p>
        </div>
        {options.length > 1 && (
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            다른 제품 보기
            <select className="h-9 rounded-md border bg-background px-2 text-sm text-foreground" value={product.id} onChange={(e) => router.push(`/reviews/${e.target.value}`)}>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      {!isOwn && lowOnly && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          별점 1~3점 리뷰만 모았어요. 불만이 많아 보이는 건 수집 조건 때문이에요.
        </p>
      )}

      {reviews.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          아직 리뷰가 없어요.{" "}
          <Link href={isOwn ? `/reviews/import?type=own&product=${product.id}` : "/reviews/import?type=competitor"} className={linkClass}>
            리뷰 가져오기 →
          </Link>
        </p>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <main className="min-w-0 space-y-5">
            {analyzedCount === 0 ? (
              <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
                리뷰 {reviews.length.toLocaleString("en-US")}건을 가져왔지만 AI 분석 전이라 강점 · 약점 · 6개 주제별 칭찬 · 불만은 아직 비어 있어요.{" "}
                <Link href={`/reviews/${product.id}/list`} className={linkClass}>
                  원문 목록에서 보기 →
                </Link>
              </p>
            ) : (
              <>
                <section className="space-y-4 rounded-xl border bg-card p-5">
                  <div>
                    <p className="text-xs text-muted-foreground">한 줄 결론</p>
                    <p className="mt-1 text-lg leading-relaxed">{conclusion}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {metrics.map((m) => (
                      <div key={m.label} className="rounded-lg border px-3 py-2.5">
                        <p className="text-xs text-muted-foreground">{m.label}</p>
                        <p className="text-xl font-semibold">{m.value}</p>
                        <p className="truncate text-xs text-muted-foreground">{m.sub}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {isOwn ? (
                  <div className="grid gap-5 md:grid-cols-2">
                    {(
                      [
                        { title: "강점 TOP 3", note: "다시 사는 이유 · 일본에서 내세울 후보", items: strengths, polarity: "positive" },
                        { title: "약점 TOP 3", note: "불만 · 일본 출시 전에 고칠 것", items: weaknesses, polarity: "negative" },
                      ] as const
                    ).map((block) => (
                      <section key={block.title} className="space-y-2 rounded-xl border bg-card p-5">
                        <div>
                          <h2 className="font-semibold">{block.title}</h2>
                          <p className="text-xs text-muted-foreground">{block.note}</p>
                        </div>
                        {block.items.length === 0 && <p className="text-sm text-muted-foreground">해당하는 주제가 없어요</p>}
                        {block.items.map((s, i) => (
                          <button
                            key={s.topic}
                            type="button"
                            aria-pressed={isActive(s.topic, block.polarity)}
                            onClick={() => pick(s.topic, block.polarity)}
                            className={`w-full space-y-1.5 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted/50 ${isActive(s.topic, block.polarity) ? "border-foreground" : ""}`}
                          >
                            <div className="flex justify-between gap-2">
                              <span className="font-medium">
                                {i + 1}. {topicLabel(s.topic, block.polarity)}
                              </span>
                              <span className="text-muted-foreground">
                                {s.count}건 · {share(s.count, reviews.length)}%
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted">
                              <div
                                className={`h-1.5 rounded-full ${block.polarity === "positive" ? "bg-sky-600" : "bg-orange-500"}`}
                                style={{ width: `${share(s.count, reviews.length)}%` }}
                              />
                            </div>
                            {s.pinned && <p className="text-xs text-muted-foreground">피부 반응이라 건수가 적어도 넣었어요</p>}
                          </button>
                        ))}
                      </section>
                    ))}
                  </div>
                ) : (
                  <section className="space-y-3 rounded-xl border bg-card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h2 className="font-semibold">불만 TOP 3 · 우리 제품이 채울 수 있나</h2>
                        <p className="text-xs text-muted-foreground">
                          {ownCompare ? `이 제품의 일본 불만과, 같은 주제에서 우리 ${ownCompare.name}의 국내 반응` : "같은 카테고리의 우리 제품 리뷰가 없어 비교할 수 없어요"}
                        </p>
                      </div>
                      {ownCompare && gapCandidates.length > 0 && (
                        <Link
                          href={`/reviews/compare?own=${ownCompare.id}&topics=${gapCandidates.map((g) => g.topic).join(",")}`}
                          className={buttonVariants({ variant: "outline" })}
                        >
                          소구점 후보 {gapCandidates.length}개 보기 →
                        </Link>
                      )}
                    </div>
                    {gaps.map((g, i) => (
                      <button
                        key={g.topic}
                        type="button"
                        aria-pressed={isActive(g.topic, "negative")}
                        onClick={() => pick(g.topic, "negative")}
                        className={`grid w-full grid-cols-[1.5rem_minmax(0,1fr)_1rem_minmax(0,1fr)_6rem] items-center gap-3 rounded-lg border p-3 text-left text-sm hover:bg-muted/50 ${isActive(g.topic, "negative") ? "border-foreground" : ""}`}
                      >
                        <span className="text-muted-foreground">{i + 1}</span>
                        <span>
                          <span className="block font-medium">{topicLabel(g.topic, "negative")}</span>
                          <span className="text-xs text-muted-foreground">
                            {g.count}건 · {share(g.count, reviews.length)}% · <span lang="ja">{APPEAL_TOPICS[g.topic].negative.ja}</span>
                          </span>
                        </span>
                        <ArrowRight className="size-4 text-muted-foreground" />
                        <span>
                          <span className="block font-medium">{topicLabel(g.topic, "positive")}</span>
                          <span className="text-xs text-muted-foreground">
                            {ownCompare ? `칭찬 ${g.ownPos}건${g.ownNeg ? ` · 불만 ${g.ownNeg}건` : ""}` : "—"}
                          </span>
                        </span>
                        <span className={`justify-self-end rounded-md border px-2 py-0.5 text-xs ${g.candidate ? "border-sky-200 text-sky-900" : "text-muted-foreground"}`}>
                          {g.candidate ? "소구점 후보" : "근거 부족"}
                        </span>
                      </button>
                    ))}
                    <p className="text-xs text-muted-foreground">줄을 누르면 그 주제의 근거 리뷰가 열려요.</p>
                  </section>
                )}

                {!isOwn && praised.length > 0 && (
                  <section className="rounded-xl border bg-card p-5">
                    <h2 className="font-semibold">낮은 별점에서도 칭찬받는 점</h2>
                    <p className="mt-1 text-sm">
                      {praised.map((s) => `${topicLabel(s.topic, "positive")} (${s.pos.length}건)`).join(" · ")}. 이 제품의 강한 점이라, 우리가 같은 주제로 맞서기는 어려워요.
                    </p>
                  </section>
                )}

                {isOwn && (
                  <section className="space-y-3 rounded-xl border bg-card p-5">
                    <div>
                      <h2 className="font-semibold">6개 주제별 칭찬 · 불만</h2>
                      <p className="text-xs text-muted-foreground">
                        AI가 리뷰를 6개 주제(소구점 찾기와 같아요)로 나눠 센 결과예요. 칭찬이 {STRENGTH_RULE.minPraises}건 이상이고 불만의 {STRENGTH_RULE.praiseToComplaintRatio}배 이상이면 강점,
                        불만이 더 많으면 약점이에요. 번호는 강점 → 근거 부족 → 약점 순이고, 같은 구분에서는 칭찬이 많은 순이에요. 카드를 누르면 근거 리뷰가 열려요.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                      {stats
                        .map((s) => ({ ...s, verdict: verdictOf(s) }))
                        .toSorted((a, b) => ["strength", "unclear", "weakness"].indexOf(a.verdict) - ["strength", "unclear", "weakness"].indexOf(b.verdict) || b.pos.length - a.pos.length)
                        .map((s, order) => {
                          return (
                            <button
                              key={s.topic}
                              type="button"
                              aria-pressed={selected?.topic === s.topic}
                              onClick={() => pick(s.topic, "all")}
                              className={`flex flex-col gap-1 rounded-lg border p-3 text-left text-sm hover:bg-muted/50 ${selected?.topic === s.topic ? "border-foreground" : ""}`}
                            >
                              <span className="flex items-center gap-2 font-medium">
                                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs tabular-nums">{order + 1}</span>
                                {APPEAL_TOPICS[s.topic].name}
                              </span>
                              <span
                                className={`w-fit rounded-md border px-1.5 text-xs ${s.verdict === "strength" ? "border-sky-200 text-sky-900" : s.verdict === "weakness" ? "border-orange-200 text-orange-900" : "text-muted-foreground"}`}
                              >
                                {VERDICT_LABEL[s.verdict]}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                칭찬 {s.pos.length}건 · 불만 {s.neg.length}건
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </section>
                )}
              </>
            )}

            <section className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-5 py-4">
              <span className="text-sm text-muted-foreground">다음으로</span>
              {isOwn ? (
                <>
                  <Link href={`/reviews/compare?own=${product.id}`} className={buttonVariants()}>
                    이 제품으로 소구점 찾기
                  </Link>
                  <Link href={`/reviews/${product.id}/translate`} className={buttonVariants({ variant: "outline" })}>
                    상세페이지용 리뷰 만들기
                  </Link>
                </>
              ) : (
                <Link href={`/reviews/${product.id}/list`} className={buttonVariants({ variant: "outline" })}>
                  리뷰 원문 목록
                </Link>
              )}
            </section>
            <p className="text-xs text-muted-foreground">
              AI가 분류한 결과예요. 판단 전에 근거 원문으로 확인하세요.
              {!isOwn && " 경쟁 제품의 불만을 광고에 직접 쓰면 비방이 될 수 있어요. 우리 제품의 장점으로만 표현하세요."}
            </p>
          </main>

          <div className="space-y-5 xl:sticky xl:top-4">
            <EvidencePanel
              open={Boolean(selected && selectedStat)}
              picks={picks}
              onClose={() => setSelected(null)}
              title={
                !selected
                  ? ""
                  : selected.polarity === "all"
                    ? `${APPEAL_TOPICS[selected.topic].name} · 칭찬 ${evidenceOf("positive").length}건 · 불만 ${evidenceOf("negative").length}건`
                    : `${topicLabel(selected.topic, selected.polarity)} · ${evidenceCount}건`
              }
            >
              <SortChips value={sort} onChange={setSort} />
              {selected &&
                shownPolarities.map((polarity) => {
                  const evidence = evidenceOf(polarity);
                  return (
                    <div key={polarity} className="space-y-2.5">
                      {selected.polarity === "all" && (
                        <p className={`text-sm font-medium ${polarity === "positive" ? "text-sky-900" : "text-orange-900"}`}>
                          {polarity === "positive" ? "칭찬" : "불만"} · {topicLabel(selected.topic, polarity)} ({evidence.length}건)
                        </p>
                      )}
                      {evidence.length === 0 && <p className="text-sm text-muted-foreground">해당하는 리뷰가 없어요</p>}
                      {evidence.slice(0, EVIDENCE_PREVIEW).map((r) => (
                        <ReviewCard key={r.id} review={r} highlight={{ topic: selected.topic, polarity }}>
                          {isOwn && (
                            <Link href={`/reviews/${product.id}/translate?pick=${r.id}`} className="text-xs font-medium text-foreground/80 hover:underline">
                              + 상세페이지용으로 담기
                            </Link>
                          )}
                        </ReviewCard>
                      ))}
                      {evidence.length > 0 && (
                        <Link href={listHref(selected.topic, polarity)} className={linkClass}>
                          {evidence.length}건 모두 원문 목록에서 보기 →
                        </Link>
                      )}
                    </div>
                  );
                })}
            </EvidencePanel>

            <section className="space-y-2.5 rounded-xl border bg-card p-4">
              <div>
                <h2 className="font-semibold">리뷰 쓴 사람</h2>
                <p className="text-xs text-muted-foreground">
                  {isOwn ? "건성 라인이 실제로 건성에게 읽히는지" : "불만을 말한 사람이 우리 타깃과 같은지"} · 피부타입을 적은 리뷰 {skin.known}건 기준 (전체 {reviews.length}건)
                </p>
              </div>
              <p className="text-xs text-muted-foreground">피부타입</p>
              {skin.items.length === 0 && <p className="text-sm text-muted-foreground">적은 리뷰가 없어요</p>}
              {skin.items.map((s) => (
                <Meter key={s.label} label={s.label} value={`${s.pct}%`} pct={s.pct} />
              ))}
              {age.items.length > 0 && (
                <>
                  <p className="text-xs text-muted-foreground">연령대</p>
                  <p className="flex flex-wrap gap-3 text-sm">
                    {age.items.map((a) => (
                      <span key={a.label}>
                        {a.label} {a.pct}%
                      </span>
                    ))}
                  </p>
                </>
              )}
            </section>

            <section className="space-y-2 rounded-xl border bg-card p-4">
              <div>
                <h2 className="font-semibold">평점 분포</h2>
                {lowOnly && <p className="text-xs text-muted-foreground">별점 4~5점은 수집하지 않았어요</p>}
              </div>
              {ratings.map((r) => (
                <Meter
                  key={r.star}
                  label={`★ ${r.star}`}
                  value={lowOnly && r.star >= 4 ? "미수집" : r.n}
                  pct={share(r.n, reviews.length)}
                />
              ))}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
