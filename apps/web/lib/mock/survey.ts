import { SurveyQuestion, SurveySummary } from "@/lib/schemas/survey";
import { parseAll } from "./helpers";

// 문항·분류 기준은 열린 질문 (CLAUDE.md 11장). 원어민 검수 전 샘플
export const surveyQuestions = parseAll(
  SurveyQuestion,
  [
    {
      id: "q1",
      text_ja: "洗顔後、肌がつっぱりますか？",
      options: [
        { value: "often", label_ja: "よくある" },
        { value: "sometimes", label_ja: "ときどき" },
        { value: "never", label_ja: "ない" },
      ],
    },
    {
      id: "q2",
      text_ja: "Tゾーンのテカリは気になりますか？",
      options: [
        { value: "yes", label_ja: "気になる" },
        { value: "no", label_ja: "気にならない" },
      ],
    },
  ],
  "surveyQuestions",
);

export const surveySummary = SurveySummary.parse({
  total: 120,
  by_skin_type: [
    { skin_type: "乾燥肌", count: 38 },
    { skin_type: "混合肌", count: 31 },
    { skin_type: "敏感肌", count: 24 },
    { skin_type: "脂性肌", count: 17 },
    { skin_type: "普通肌", count: 10 },
  ],
});
