import { getSurveyProductLines, getSurveyQuestions } from "@/lib/data";
import { SurveyResult } from "./survey-result";

// 결과 문구 · 추천 문구는 광고이므로 약기법 검토 대상이다 (CLAUDE.md 11장). 광고 검토 담당 결과를 받아 합친다
export default async function SurveyResultPage() {
  const [questions, lines] = await Promise.all([getSurveyQuestions(), getSurveyProductLines()]);
  return <SurveyResult questions={questions} lines={lines} />;
}
