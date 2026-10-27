import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { getAnalysisStatus } from "@/lib/data/review-analysis-actions";
import { getReviewProductList, getReviewsOf } from "@/lib/data/reviews";
import { platformLabel } from "@/lib/platforms";
import { titleParts } from "@/lib/product-title";
import { AnalyzeButton } from "./_components/analyze-button";
import { ImportButton } from "./_components/parts";
import { CompetitorTable, type CompetitorRow } from "./competitor-table";
import { average, latestDate, SKIN_LINE_LABEL, topicLabel, topicStats, topThree, verdictOf } from "./_lib/topics";

const CATEGORY_LABEL: Record<string, string> = { 化粧水: "스킨", 美容液: "에센스" };
const categoryLabel = (c: string | null) => (c ? (CATEGORY_LABEL[c] ?? c) : "카테고리 없음");

export default async function ReviewsPage() {
  const products = await getReviewProductList();
  const withReviews = await Promise.all(products.map(async (p) => ({ ...p, reviews: await getReviewsOf(p.id) })));
  const analysis = await getAnalysisStatus();

  const own = withReviews
    .filter((p) => p.kind === "own")
    .map((p) => {
      const ko = p.reviews.filter((r) => r.lang === "ko");
      const stats = topicStats(ko);
      const analyzed = ko.some((r) => r.analysis);
      const [strength] = topThree(stats, "positive");
      const [weakness] = topThree(stats, "negative");
      return {
        ...p,
        ko,
        analyzed,
        strength: strength && topicLabel(strength.topic, "positive"),
        weakness: weakness && topicLabel(weakness.topic, "negative"),
        strengths: new Set(stats.filter((s) => verdictOf(s) === "strength").map((s) => s.topic)),
      };
    });
  // 자사 제품 순서(Deep Skin → Core Essence)는 getReviewProductList가 정한다. 출시 전 제품은 오른쪽 한 칸에 이름만
  const onSale = own.filter((p) => p.saleStatus !== "in_development");
  const unreleased = own.filter((p) => p.saleStatus === "in_development");

  const competitors: CompetitorRow[] = withReviews
    .filter((p) => p.kind === "competitor")
    .map((p) => {
      const ja = p.reviews.filter((r) => r.lang === "ja");
      const stats = topicStats(ja);
      const [pain] = topThree(stats, "negative");
      // 같은 카테고리의 우리 제품 중 리뷰가 가장 많은 것과 비교한다
      const mine = own.find((o) => o.category === p.category && o.analyzed);
      const candidates = mine ? stats.filter((s) => s.neg.length > 0 && mine.strengths.has(s.topic)).length : 0;
      return {
        id: p.id,
        name: titleParts({ brand: p.brand, name: p.name }).full,
        title: titleParts({ brand: p.brand, name: p.name, title_ai: p.titleAi }).main,
        caption: titleParts({ brand: p.brand, name: p.name, title_ai: p.titleAi }).caption,
        category: categoryLabel(p.category),
        platform: platformLabel(p.platform),
        rank: p.rank,
        count: ja.length,
        pain: pain ? topicLabel(pain.topic, "negative") : null,
        candidates,
      };
    });

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="리뷰 리포트" description="제품을 고르면 그 제품의 강점·약점과 근거 리뷰를 볼 수 있어요" featureId="E" />
        <ImportButton />
      </div>
      <AnalyzeButton pending={analysis.pending} untranslated={analysis.untranslated} untitled={analysis.untitled} />

      <section className="mb-8 space-y-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg font-semibold">우리 제품</h2>
          <span className="text-sm text-muted-foreground">국내 리뷰 기준 · 판매 중 {onSale.length}개</span>
        </div>
        <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.85fr)]">
          {onSale.map((p) => (
            <Link
              key={p.id}
              href={p.ko.length === 0 ? `/reviews/import?type=own&product=${p.id}` : `/reviews/${p.id}`}
              className="group flex flex-col gap-4 rounded-2xl border bg-card p-6 transition-colors hover:border-foreground/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-semibold">{p.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {[p.skinLine && SKIN_LINE_LABEL[p.skinLine], categoryLabel(p.category), latestDate(p.ko) && `마지막 수집 ${latestDate(p.ko)?.slice(5)}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span className="flex size-9 flex-none items-center justify-center rounded-full border transition-colors group-hover:bg-muted" aria-hidden>
                  <ArrowUpRight className="size-4" />
                </span>
              </div>

              {p.ko.length === 0 ? (
                <p className="text-sm text-muted-foreground">아직 리뷰가 없어요. 리뷰 가져오기에서 국내 리뷰를 올려 주세요 →</p>
              ) : !p.analyzed ? (
                <p className="text-sm text-muted-foreground">리뷰를 가져왔지만 AI 분석 전이에요. 들어가서 분석해 주세요 →</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-emerald-50/70 px-4 py-3">
                    <span className="block text-xs font-medium text-emerald-800">강점</span>
                    <b className="text-base text-foreground">{p.strength ?? "아직 없음"}</b>
                  </div>
                  <div className="rounded-xl bg-orange-50 px-4 py-3">
                    <span className="block text-xs font-medium text-orange-800">약점</span>
                    <b className="text-base text-foreground">{p.weakness ?? "아직 없음"}</b>
                  </div>
                </div>
              )}

              {p.ko.length > 0 && (
                <div className="mt-auto flex items-baseline gap-6 text-sm text-muted-foreground">
                  <span>
                    리뷰 <b className="text-xl font-semibold text-foreground">{p.ko.length}</b>건
                  </span>
                  <span>
                    평균 별점 <b className="text-xl font-semibold text-foreground">★ {average(p.ko.map((r) => r.rating))}</b>
                  </span>
                </div>
              )}
            </Link>
          ))}

          {/* 출시 전 제품은 리뷰가 없어 갈 곳이 없다: 한 칸에 이름만 모아 둔다 */}
          {unreleased.length > 0 && (
            <div className="flex flex-col gap-3 rounded-2xl bg-emerald-50/60 p-6">
              <div>
                <p className="font-semibold text-emerald-900">출시 전 제품 {unreleased.length}종</p>
                <p className="text-xs text-muted-foreground">판매를 시작하면 리포트가 생겨요</p>
              </div>
              <ul className="space-y-2">
                {unreleased.map((p) => (
                  <li key={p.id} className="rounded-lg bg-background/80 px-4 py-2.5 text-sm">
                    {p.name.replace(/^Leaf& Dew /, "")}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        {/* 제목 줄은 표가 그린다 (건수 · 수집 기준 포함) */}
        <CompetitorTable rows={competitors} />
      </section>
    </>
  );
}
