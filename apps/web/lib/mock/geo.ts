import { GeoSnapshot } from "@/lib/schemas/geo";
import { parseAll, ts, WORKSPACE_ID } from "./helpers";

// 일본어 질의 5개 × AI 엔진 3개 (prototype-plan P3). 답변은 실제 엔진 응답이 아니라 형식만 흉내 낸 샘플
const ENGINE_TIMES: Record<string, string> = { ChatGPT: "09:00", Gemini: "09:04", Perplexity: "09:07" };

const rows: { engine: string; query: string; answer: string; brands_mentioned: string[] }[] = [
  {
    engine: "ChatGPT",
    query: "乾燥肌におすすめの韓国スキンケア",
    answer: "乾燥肌向けの韓国スキンケアでは、ヒアルロン酸やセラミド配合の化粧水・美容液が定番です。例えば SampleG のヒアルロン酸ローション、SampleD のセラミドアンプル、Leafn のモイストバランス化粧水などが挙げられます。(샘플)",
    brands_mentioned: ["SampleG", "SampleD", "Leafn"],
  },
  {
    engine: "Gemini",
    query: "乾燥肌におすすめの韓国スキンケア",
    answer: "セラミドやパンテノールを含むアイテムが人気です。SampleD や SampleA のシリーズは口コミ数が多く、比較しやすいでしょう。(샘플)",
    brands_mentioned: ["SampleD", "SampleA"],
  },
  {
    engine: "Perplexity",
    query: "乾燥肌におすすめの韓国スキンケア",
    answer: "楽天のランキングでは SampleA と SampleG が上位です。新しいブランドでは Leafn が乾燥肌向けラインを展開しています。[1][2] (샘플)",
    brands_mentioned: ["SampleA", "SampleG", "Leafn"],
  },
  {
    engine: "ChatGPT",
    query: "セラミド 美容液 プチプラ",
    answer: "プチプラのセラミド美容液なら SampleD が代表的です。SampleB のセラミドトナーと組み合わせる使い方も紹介されています。(샘플)",
    brands_mentioned: ["SampleD", "SampleB"],
  },
  {
    engine: "Gemini",
    query: "セラミド 美容液 プチプラ",
    answer: "セラミドNP配合の美容液として、SampleD、SampleF、Leafn のモイストリペアエッセンスが比較対象になります。(샘플)",
    brands_mentioned: ["SampleD", "SampleF", "Leafn"],
  },
  {
    engine: "Perplexity",
    query: "セラミド 美容液 プチプラ",
    answer: "楽天のレビューでは SampleD の評価が高く、レビュー件数も多いです。[1] (샘플)",
    brands_mentioned: ["SampleD"],
  },
  {
    engine: "ChatGPT",
    query: "敏感肌 化粧水 韓国",
    answer: "ツボクサエキスやドクダミエキス配合の化粧水が人気で、SampleA や Leafn のシカ水分トナーがよく紹介されます。(샘플)",
    brands_mentioned: ["SampleA", "Leafn"],
  },
  {
    engine: "Gemini",
    query: "敏感肌 化粧水 韓国",
    answer: "SampleA のドクダミ化粧水が話題です。(샘플)",
    brands_mentioned: ["SampleA"],
  },
  {
    engine: "Perplexity",
    query: "敏感肌 化粧水 韓国",
    answer: "比較記事では SampleA、SampleB、SampleG の順で言及が多いです。[1][3] (샘플)",
    brands_mentioned: ["SampleA", "SampleB", "SampleG"],
  },
  {
    engine: "ChatGPT",
    query: "大容量 化粧水 コスパ",
    answer: "大容量でコスパが良い化粧水として、SampleA（250mL）、SampleG（200mL）、Leafn（200mL）などがあります。(샘플)",
    brands_mentioned: ["SampleA", "SampleG", "Leafn"],
  },
  {
    engine: "Gemini",
    query: "大容量 化粧水 コスパ",
    answer: "SampleA と SampleG は容量あたりの価格が手頃です。(샘플)",
    brands_mentioned: ["SampleA", "SampleG"],
  },
  {
    engine: "Perplexity",
    query: "大容量 化粧水 コスパ",
    answer: "mLあたりの価格で比べると SampleA が最も安く、次いで SampleG です。[2] (샘플)",
    brands_mentioned: ["SampleA", "SampleG"],
  },
  {
    engine: "ChatGPT",
    query: "メガ割 おすすめ スキンケア",
    answer: "メガ割では SampleD のアンプルや SampleB のトナーがセット販売されることが多いです。(샘플)",
    brands_mentioned: ["SampleD", "SampleB"],
  },
  {
    engine: "Gemini",
    query: "メガ割 おすすめ スキンケア",
    answer: "SampleD、SampleF が人気です。SampleE や SampleH など日本ブランドも比較されます。(샘플)",
    brands_mentioned: ["SampleD", "SampleF", "SampleE", "SampleH"],
  },
  {
    engine: "Perplexity",
    query: "メガ割 おすすめ スキンケア",
    answer: "メガ割期間は通常価格との差を比較し、成分と容量あたりの価格で選ぶのがおすすめです。(샘플)",
    brands_mentioned: [],
  },
];

// brands_mentioned는 답변 원문에 실제로 나온 브랜드만 (화면이 원문 위에 표시한다)
for (const r of rows) {
  for (const b of r.brands_mentioned) {
    if (!r.answer.includes(b)) throw new Error(`가짜 데이터 검증 실패: geo ${r.engine}·${r.query}의 ${b}가 답변에 없음`);
  }
}

export const geoSnapshots = parseAll(
  GeoSnapshot,
  rows.map((g, i) => ({
    ...g,
    id: `geo-${i + 1}`,
    workspace_id: WORKSPACE_ID,
    created_at: ts("2026-10-20", ENGINE_TIMES[g.engine]),
    captured_at: ts("2026-10-20", ENGINE_TIMES[g.engine]),
  })),
  "geoSnapshots",
);
