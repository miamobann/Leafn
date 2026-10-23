import Link from "next/link";

// 개인정보 안내 v0.1 (전문가 확인 전). [ ] 부분은 확정 전 자리 문구
// 출처: 제미나이 정리안(수집 항목 · 이용 목적 · 면책 · 미성년자) + 팀 결정(18세 기준, 미성년자 참여 수만 기록, 출시 알림 별도 저장)
// 수집하지 않는 쿠키 · 접속 기기 정보는 적지 않는다 (분석 도구를 넣을 때 추가)
const COPY = {
  title: "個人情報の取扱いについて",
  draft: "掲載している文言は専門家による確認前の案です。［ ］内は確定前の項目です。",
  sections: [
    { heading: "1. 事業者", body: ["Leaf&　［住所］　［代表者名］"] },
    {
      heading: "2. 収集する情報",
      body: [
        "当サービスでは、診断結果を提供するため、年齢（年代）、肌質、肌の悩みに関するアンケート回答内容、およびこの診断を知ったきっかけ（共有リンクの種類または選択いただいた項目）を収集します。",
        "※ 診断アンケートでは、氏名、メールアドレス、電話番号などの個人を直接特定できる情報は収集いたしません。自由記入欄にも個人を特定できる内容は記入しないでください。",
      ],
    },
    {
      heading: "3. 利用目的",
      body: [
        "1. 回答内容に基づいたスキンケア情報および製品の推奨結果の表示",
        "2. 個人を特定できない統計データに加工した上での、サービス改善および製品企画のためのマーケティング分析",
      ],
    },
    {
      heading: "4. 未成年者の保護",
      body: [
        "18歳未満の利用者の回答データは、サーバー上に一切保管・蓄積されません。参加状況の把握のため、年代や回答内容を含まない参加件数のみを記録します。",
      ],
    },
    { heading: "5. 保存期間", body: ["回答データは3年間保存したのち、削除します。"] },
    {
      heading: "6. 国外での取扱い",
      body: ["回答データは大韓民国の事業者（Leaf&）が管理します。［韓国における個人情報保護制度の概要］［事業者が講じる措置］"],
    },
    {
      heading: "7. 発売のお知らせ（メール・LINE）",
      body: [
        "診断結果の画面で発売のお知らせをお申し込みいただいた場合に限り、以下の情報を取得します。",
        "取得する情報：メールの場合はメールアドレス、LINEの場合は公式アカウントの友だち追加時に取得するユーザー識別子、ご希望の商品ライン、同意日時",
        "利用目的：ご選択いただいた商品ラインの発売案内の送信のみ",
        "診断との関係：診断の回答・結果とは別に保管し、ひも付けません。",
        "配信停止と削除：メール内のリンクまたはLINEのブロックでいつでも配信を停止でき、停止時に削除します。［発売案内の送信後◯か月で削除］",
        "18歳未満の方はお申し込みいただけません。",
      ],
    },
    {
      heading: "8. 免責事項",
      body: ["本診断は、肌タイプに合わせたスキンケアの参考情報を提供するものであり、医師による診断や治療行為に代わるものではありません。"],
    },
    { heading: "9. お問い合わせ・削除のご請求", body: ["［窓口のメールアドレス］　［受付方法］"] },
  ],
  footer: "制定日：［YYYY年MM月DD日］　文言バージョン：v0.1",
  back: "診断に戻る",
};

export default function SurveyPrivacyPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Link href="/survey" className="text-sm underline underline-offset-4">
        ← {COPY.back}
      </Link>
      <h1 className="text-2xl font-semibold">{COPY.title}</h1>
      <p className="rounded-lg border border-dashed bg-muted px-4 py-3 text-sm">{COPY.draft}</p>
      <div className="space-y-6 rounded-lg border p-5 text-sm leading-relaxed">
        {COPY.sections.map((s) => (
          <section key={s.heading} className="space-y-1.5">
            <h2 className="font-semibold">{s.heading}</h2>
            {s.body.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </section>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{COPY.footer}</p>
    </div>
  );
}
