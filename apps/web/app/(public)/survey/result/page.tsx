import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// 결과 문구에 제품 추천이 들어가면 광고이므로 약기법 검토 대상이다 (CLAUDE.md 11장)
export default function SurveyResultPage() {
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">診断結果</h1>
      <Card>
        <CardHeader>
          <CardTitle>乾燥肌タイプ (サンプル)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p>うるおいを保つスキンケアがおすすめです。(サンプル文言)</p>
        </CardContent>
      </Card>
    </>
  );
}
