import Link from "next/link";
import { StartLink } from "./start-link";

// 일본어 문구는 원어민 검수 전. 미성년자 사전 고지는 개인정보 안내 v0.1과 맞춘다
const COPY = {
  title: "肌タイプ診断",
  lead: "10の質問に答えると、肌の皮脂・乾燥・敏感の傾向と、肌タイプの目安がわかります。",
  facts: [
    { label: "所要時間", value: "約3分" },
    { label: "質問数", value: "10問" },
  ],
  minorNotice: "※ 18歳未満の方の回答データはサーバーに保存されず、診断結果の表示のみに使用されます。",
  privacyLink: "個人情報の取扱いについて",
  start: "はじめる",
  footer: "© Leaf&（デモ）",
};

export default function SurveyPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{COPY.title}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{COPY.lead}</p>
      </div>
      <dl className="divide-y rounded-lg border text-sm">
        {COPY.facts.map((f) => (
          <div key={f.label} className="flex justify-between px-4 py-3">
            <dt className="text-muted-foreground">{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs leading-relaxed text-muted-foreground">{COPY.minorNotice}</p>
      <StartLink label={COPY.start} />
      <Link href="/survey/privacy" className="text-center text-sm underline underline-offset-4">
        {COPY.privacyLink}
      </Link>
      <p className="text-center text-xs text-muted-foreground">{COPY.footer}</p>
    </div>
  );
}
