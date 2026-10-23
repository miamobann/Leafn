import { getSurveyQuestions } from "@/lib/data";
import { SurveyFlow } from "./survey-flow";

export default async function SurveyQuestionsPage() {
  const questions = await getSurveyQuestions();
  return <SurveyFlow questions={questions} />;
}
