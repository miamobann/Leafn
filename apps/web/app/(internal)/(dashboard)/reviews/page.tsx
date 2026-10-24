import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { getReviewProductList, getReviewsOf } from "@/lib/data/reviews";
import { platformLabel } from "@/lib/platforms";
import { ImportButton } from "./_components/parts";
import { CompetitorTable, type CompetitorRow } from "./competitor-table";
import { average, latestDate, SKIN_LINE_LABEL, topicLabel, topicStats, topThree, verdictOf } from "./_lib/topics";

const CATEGORY_LABEL: Record<string, string> = { 化粧水: "화장수", 美容液: "세럼" };
const categoryLabel = (c: string | null) => (c ? (CATEGORY_LABEL[c] ?? c) : "카테고리 없음");

export default async function ReviewsPage() {
  const products = await getReviewProductList();
  const withReviews = await Promise.all(products.map(async (p) => ({ ...p, reviews: await getReviewsOf(p.id) })));

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
    })
    .toSorted((a, b) => b.ko.length - a.ko.length); // 리뷰 없는 제품은 아래로

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
        name: `${p.brand} ${p.name}`,
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

      <section className="mb-8 space-y-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg font-semibold">우리 제품</h2>
          <span className="text-sm text-muted-foreground">국내 리뷰 기준 · {own.length}개</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {own.map((p) => {
            const status = p.ko.length === 0 ? "리뷰 없음" : p.analyzed ? "분석 완료" : "분석 전";
            return (
              <Link
                key={p.id}
                href={p.ko.length === 0 ? `/reviews/import?type=own&product=${p.id}` : `/reviews/${p.id}`}
                className="flex flex-col gap-3 rounded-xl border bg-card p-5 transition-colors hover:border-foreground/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold">{p.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {[p.skinLine && SKIN_LINE_LABEL[p.skinLine], categoryLabel(p.category), p.saleStatus === "in_development" && "개발중"]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <span className={`rounded-md px-2 py-0.5 text-xs whitespace-nowrap ${p.analyzed ? "bg-emerald-50 text-emerald-900" : "bg-muted text-muted-foreground"}`}>
                    {status}
                  </span>
                </div>
                {p.ko.length === 0 ? (
                  <>
                    <p className="text-sm text-muted-foreground">아직 리뷰가 없어요. 출시 전이거나 리뷰를 가져오지 않았어요.</p>
                    <span className="text-sm font-medium text-foreground/80">리뷰 가져오기 →</span>
                  </>
                ) : (
                  <>
                    {p.analyzed && p.strength && (
                      <p className="text-sm">
                        가장 많이 칭찬받은 점은 ‘{p.strength}’{p.weakness ? `, 가장 큰 불만은 ‘${p.weakness}’예요.` : "이에요."}
                      </p>
                    )}
                    {!p.analyzed && <p className="text-sm text-muted-foreground">리뷰를 가져왔지만 AI 분석 전이에요.</p>}
                    {p.analyzed && (
                      <div className="flex flex-wrap gap-2 text-xs">
                        {p.strength && <span className="rounded-md border border-sky-200 px-2 py-0.5 text-sky-900">강점 · {p.strength}</span>}
                        {p.weakness && <span className="rounded-md border border-orange-200 px-2 py-0.5 text-orange-900">약점 · {p.weakness}</span>}
                      </div>
                    )}
                    <div className="flex gap-4 border-t pt-2.5 text-sm text-muted-foreground">
                      <span>리뷰 {p.ko.length}건</span>
                      <span>평균 ★ {average(p.ko.map((r) => r.rating))}</span>
                      {latestDate(p.ko) && <span className="ml-auto">수집 {latestDate(p.ko)?.slice(5)}</span>}
                    </div>
                  </>
                )}
              </Link>
            );
          })}
        </div>
      </section>

      <CompetitorTable rows={competitors} />
    </>
  );
}
