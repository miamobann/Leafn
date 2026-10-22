import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { BarList, OverviewTemplate, ReportTemplate } from "@/components/templates";
import { getSurveyQuestions, getSurveySummary } from "@/lib/data";

export default async function SurveyResultsPage() {
  const [summary, questions] = await Promise.all([getSurveySummary(), getSurveyQuestions()]);
  const top = summary.by_skin_type.toSorted((a, b) => b.count - a.count)[0];

  return (
    <>
      <PageHeader title="설문 응답 집계" description="일본 소비자 피부타입 설문 결과 (샘플)" featureId="G" />
      <OverviewTemplate
        stats={[
          { label: "응답 수", value: `${summary.total}건` },
          { label: "가장 많은 피부타입", value: top?.skin_type ?? "—" },
          { label: "문항 수", value: `${questions.length}개` },
          { label: "설문 링크", value: "/survey" },
        ]}
        sections={[]}
      />
      <div className="mt-6">
        <ReportTemplate
          cards={[
            {
              title: "피부타입 분포",
              wide: true,
              content: <BarList items={summary.by_skin_type.map((s) => ({ label: s.skin_type, value: s.count }))} />,
            },
          ]}
        />
      </div>
      <Link href="/survey" target="_blank" className="mt-4 inline-block text-sm underline-offset-4 hover:underline">
        공개 설문 열기 ↗
      </Link>
    </>
  );
}
