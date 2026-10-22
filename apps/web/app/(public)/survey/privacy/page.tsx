import Link from "next/link";

// APPI 동의·이용 목적·국외 이전 고지 문구는 확인 전 (CLAUDE.md 11장)
export default function SurveyPrivacyPage() {
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">個人情報の取り扱い</h1>
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>利用目的、保存期間、第三者提供・国外移転について記載します。(文言確認中)</p>
      </div>
      <Link href="/survey" className="mt-6 inline-block text-sm underline">
        戻る
      </Link>
    </>
  );
}
