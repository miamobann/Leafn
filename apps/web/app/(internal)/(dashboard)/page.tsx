import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { OverviewTemplate } from "@/components/templates";
import { getActivity, getAdChecks, getPromoEvents, getReviews, getSurveySummary } from "@/lib/data";
import { dDay, formatDate } from "@/lib/format";

export default async function HomePage() {
  const [pending, events, reviews, survey, activity] = await Promise.all([
    getAdChecks({ status: "pending" }),
    getPromoEvents(),
    getReviews(),
    getSurveySummary(),
    getActivity(),
  ]);
  const next = events[0];

  return (
    <>
      <PageHeader title="홈" description="이번 주 할 일과 팀 활동" featureId="J" />
      <OverviewTemplate
        stats={[
          { label: "승인 대기 문구", value: `${pending.length}건` },
          { label: "다음 행사", value: next ? `${dDay(next.start_date)}` : "—" },
          { label: "분석된 리뷰", value: `${reviews.length}건` },
          { label: "설문 응답", value: `${survey.total}건` },
        ]}
        sections={[
          {
            title: "할 일",
            items: [
              ...pending.map((a) => (
                <Link key={a.id} href={`/ad-check/${a.id}`} className="hover:underline">
                  광고 문구 검토 대기 · {a.input_text}
                </Link>
              )),
              ...events.slice(0, 2).map((e) => (
                <span key={e.id}>
                  {e.title} 준비 마감 {dDay(e.prep_due_date)}
                </span>
              )),
            ],
          },
          {
            title: "최근 활동",
            items: activity.map((a) => (
              <span key={a.id}>
                {a.actor_name} · {a.action} <span className="text-muted-foreground">{formatDate(a.created_at)}</span>
              </span>
            )),
          },
        ]}
      />
    </>
  );
}
