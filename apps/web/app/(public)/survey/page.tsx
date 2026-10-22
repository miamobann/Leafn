import Link from "next/link";
import { StepFormTemplate } from "@/components/templates";

// 동의 체크 상태는 P7에서 연결. 지금은 시작 버튼을 비활성으로 둔다 (동의 전 시작 불가).
export default function SurveyPage() {
  return (
    <>
      <h1 className="mb-2 text-xl font-semibold">肌タイプ診断</h1>
      <p className="mb-6 text-sm text-muted-foreground">所要時間 約1分 · 回答は匿名で保存されます</p>
      <StepFormTemplate step={0} total={2} nextHref="/survey/questions" nextLabel="はじめる" nextDisabled>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" />
          <span>
            <Link href="/survey/privacy" className="underline">
              個人情報の取り扱い
            </Link>
            に同意します
          </span>
        </label>
      </StepFormTemplate>
    </>
  );
}
