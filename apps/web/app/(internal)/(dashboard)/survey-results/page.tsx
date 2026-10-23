import { ViewStateGate } from "@/components/common/view-state";
import { PageHeader } from "@/components/layout/page-header";
import { getSurveyProductLines, getSurveyQuestions, getSurveySummary } from "@/lib/data";
import { SurveyResultsView } from "./survey-results-view";

export default async function SurveyResultsPage() {
  const [summary, questions, lines] = await Promise.all([getSurveySummary(), getSurveyQuestions(), getSurveyProductLines()]);

  return (
    <>
      <PageHeader title="설문 응답 집계" description={`일본 소비자 피부타입 설문 결과 (더미 응답 ${summary.total}건 · 실제 저장 연결 전)`} featureId="G" />
      {/* 응답이 없으면 빈 화면, 주소에 ?state=loading|error를 붙이면 불러오는 중 · 오류 화면 (prototype-plan 4.1) */}
      <ViewStateGate state={summary.total === 0 ? "empty" : "ready"} emptyAction="요약 탭의 설문 링크를 공유해 보세요">
        <SurveyResultsView summary={summary} questions={questions} lines={lines} />
      </ViewStateGate>
    </>
  );
}
