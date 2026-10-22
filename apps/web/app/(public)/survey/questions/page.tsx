import { StepFormTemplate } from "@/components/templates";
import { getSurveyQuestions } from "@/lib/data";

export default async function SurveyQuestionsPage() {
  const questions = await getSurveyQuestions();
  const q = questions[0];

  return (
    <StepFormTemplate step={1} total={questions.length} prevHref="/survey" prevLabel="戻る" nextHref="/survey/result" nextLabel="次へ">
      {q && (
        <fieldset className="space-y-3">
          <legend className="mb-3 font-medium">{q.text_ja}</legend>
          {q.options.map((o) => (
            <label key={o.value} className="flex items-center gap-2 rounded-md border p-3 text-sm">
              <input type="radio" name={q.id} value={o.value} />
              {o.label_ja}
            </label>
          ))}
        </fieldset>
      )}
    </StepFormTemplate>
  );
}
