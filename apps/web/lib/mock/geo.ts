import { GeoSnapshot, type GeoEngine } from "@/lib/schemas/geo";
import type { SkinConcern } from "@/lib/schemas/trend";
import { brandDictionary, detectBrands, detectKeywords, domainOf, rankMentions, verifyInAnswer } from "@/lib/external/geo-terms";
import { parseAll, ts, WORKSPACE_ID } from "./helpers";
import { products } from "./products";
import { OWN_BRAND } from "@/lib/own-products";

// 일본어 질의 5개 × AI 엔진 3개 (+ ChatGPT 1개 질의는 3회 반복 예시). 답변은 실제 엔진 응답이 아니라 형식만 흉내 낸 샘플
// brand_mentions·keywords는 실제 분석과 같은 사전 함수로 답변에서 뽑는다. llm = 사전에 없어 LLM이 뽑았다고 가정한 말 (원문 대조 통과)
// 인용 URL은 형식만 흉내 낸 가짜 주소 (sample-…)

const MODEL: Record<GeoEngine, string> = { chatgpt: "gpt-4o", claude: "claude-sonnet-5-5", gemini: "gemini-2.5-flash", perplexity: "sonar" };
const ENGINE_TIMES: Record<GeoEngine, string> = { chatgpt: "09:00", claude: "09:02", gemini: "09:04", perplexity: "09:07" };
/** 질의 → 카테고리 (美容液 질의 1개, 나머지는 化粧水) */
const CATEGORY_OF = (query: string) => (query === Q_PORES ? "美容液" : "化粧水");

type Row = {
  engine: GeoEngine;
  query: string;
  concern: SkinConcern | null;
  run?: number;
  answer: string;
  citations: [url: string, title: string][];
  llmBrands?: string[];
  llmKeywords?: string[];
};

const Q_DRY = "乾燥肌におすすめの韓国スキンケア";
const Q_SENSITIVE = "敏感肌 化粧水 韓国";
const Q_PORES = "毛穴ケアに効果的な美容液を教えて";
const Q_20S = "20代 敏感肌におすすめの韓国化粧水は？";
const Q_VALUE = "大容量 化粧水 コスパ";

const rows: Row[] = [
  {
    engine: "chatgpt",
    query: Q_DRY,
    concern: "dryness",
    answer:
      "乾燥肌にはセラミドやヒアルロン酸配合のアイテムが定番です。SampleD のセラミドアンプルは@cosmeランキング上位の常連で、無香料なのも支持されています。SampleG のヒアルロン酸ローションは大容量でコスパが良いと評判です。Leaf& のモイストバランススキンもヒアルロン酸配合で、乾燥肌向けラインとして紹介されています。(샘플)",
    citations: [
      ["https://www.cosme.net/sample-ranking-lotion", "化粧水ランキング"],
      ["https://the360.life/sample-ldk-moisture", "保湿化粧水 徹底比較"],
    ],
  },
  {
    engine: "gemini",
    query: Q_DRY,
    concern: "dryness",
    answer:
      "セラミドやパンテノールを含むアイテムが人気です。SampleD はアルコールフリーで低刺激、SampleA のシリーズは口コミ数が多く比較しやすいでしょう。(샘플)",
    citations: [
      ["https://www.cosme.net/sample-review-ampoule", "SampleD セラミドアンプルの口コミ"],
      ["https://maquia.hpplus.jp/sample-dry-skin", "乾燥肌さん向け韓国コスメ"],
    ],
  },
  {
    engine: "perplexity",
    query: Q_DRY,
    concern: "dryness",
    answer:
      "楽天のランキングでは SampleA と SampleG が上位です。SampleG は無香料・アルコールフリーで、LDKの比較テストでも保湿力が評価されました。新しいブランドでは Leaf& が乾燥肌向けラインを展開しています。(샘플)",
    citations: [
      ["https://the360.life/sample-ldk-moisture", "保湿化粧水 徹底比較"],
      ["https://item.rakuten.co.jp/sample-shop/sample-g-lotion", "SampleG ヒアルロン酸ローション"],
      ["https://prtimes.jp/main/html/rd/p/sample-leafn.html", "Leaf& 日本上陸のお知らせ"],
    ],
  },
  ...[1, 2, 3].map(
    (run): Row => ({
      engine: "chatgpt",
      query: Q_SENSITIVE,
      concern: "sensitivity",
      run,
      answer: [
        "敏感肌には低刺激でノンコメドジェニックテスト済みの化粧水が安心です。SampleA のドクダミ化粧水は無香料・アルコールフリーで、@cosmeランキングでも上位です。Leaf& のシカ水分トナーもツボクサエキス配合でよく紹介されます。(샘플)",
        "SampleA のドクダミ化粧水は無香料でノンコメドジェニックテスト済み、敏感肌の定番です。SampleB のセラミドトナーも低刺激で人気があります。(샘플)",
        "敏感肌向けなら SampleA が代表的で、アルコールフリー・無香料の処方です。Leaf& はシカ配合のトナーで、低刺激をうたっています。(샘플)",
      ][run - 1],
      citations: [
        ["https://www.cosme.net/sample-ranking-sensitive", "敏感肌 化粧水ランキング"],
        ...(run === 1 ? ([["https://ameblo.jp/sample-blogger/entry-1", "敏感肌の私が選ぶ韓国化粧水"]] as [string, string][]) : []),
      ],
    }),
  ),
  {
    engine: "gemini",
    query: Q_SENSITIVE,
    concern: "sensitivity",
    answer: "SampleA のドクダミ化粧水が話題です。パッチテスト済みで無香料なので、敏感肌でも試しやすいと評判です。(샘플)",
    citations: [["https://www.cosme.net/sample-review-dokudami", "SampleA ドクダミ化粧水の口コミ"]],
  },
  {
    engine: "perplexity",
    query: Q_SENSITIVE,
    concern: "sensitivity",
    answer:
      "比較記事では SampleA、SampleB、SampleG の順で言及が多いです。いずれもノンコメドジェニックテスト済みと記載があります。新興ブランドの SampleNova もアルコールフリーで注目されています。(샘플)",
    citations: [
      ["https://the360.life/sample-ldk-sensitive", "敏感肌用化粧水 比較"],
      ["https://biteki.com/sample-sensitive-korea", "敏感肌向け韓国コスメ特集"],
    ],
    llmBrands: ["SampleNova"],
  },
  {
    engine: "chatgpt",
    query: Q_PORES,
    concern: "pores",
    answer:
      "毛穴ケアにはナイアシンアミドやビタミンC誘導体配合の美容液が効果的とされます。SampleE のナイアシンアミド美容液は@cosmeランキングの常連で、SampleH のビタミンC美容液も人気です。(샘플)",
    citations: [["https://www.cosme.net/sample-ranking-serum", "美容液ランキング"]],
  },
  {
    engine: "gemini",
    query: Q_PORES,
    concern: "pores",
    answer: "SampleF のレチノールセラムや SampleE が人気です。皮脂ケアにはアゼライン酸配合の美容液も話題になっています。(샘플)",
    citations: [["https://maquia.hpplus.jp/sample-pores", "毛穴ケア美容液まとめ"]],
    llmKeywords: ["アゼライン酸"],
  },
  {
    engine: "perplexity",
    query: Q_PORES,
    concern: "pores",
    answer: "LDKの比較では SampleE のナイアシンアミド美容液がベストコスメ受賞の評価でした。ノンコメドジェニックテスト済みである点も選ばれる理由です。(샘플)",
    citations: [
      ["https://the360.life/sample-ldk-serum", "毛穴美容液 徹底比較"],
      ["https://prtimes.jp/main/html/rd/p/sample-e.html", "SampleE ベストコスメ受賞"],
    ],
  },
  {
    engine: "chatgpt",
    query: Q_20S,
    concern: "sensitivity",
    answer:
      "20代の敏感肌には、プチプラで無香料の化粧水が選ばれています。SampleA のドクダミ化粧水と SampleB のセラミドトナーが定番で、どちらも@cosmeランキングに入っています。(샘플)",
    citations: [["https://www.cosme.net/sample-ranking-20s", "20代に人気の化粧水"]],
  },
  {
    engine: "gemini",
    query: Q_20S,
    concern: "sensitivity",
    answer: "SampleA と Leaf& のシカ水分トナーがよく比較されます。SampleA はアルコールフリー、Leaf& は低刺激処方と紹介されています。(샘플)",
    citations: [["https://note.com/sample-writer/n/sample01", "20代敏感肌のスキンケア"]],
  },
  {
    engine: "perplexity",
    query: Q_20S,
    concern: "sensitivity",
    answer: "20代向けでは SampleB と SampleG が上位です。弱酸性・無香料の処方が支持されています。(샘플)",
    citations: [
      ["https://www.cosme.net/sample-ranking-20s", "20代に人気の化粧水"],
      ["https://biteki.com/sample-20s", "20代の韓国化粧水"],
    ],
  },
  {
    engine: "chatgpt",
    query: Q_VALUE,
    concern: null,
    answer: "大容量でコスパが良い化粧水として、SampleA（250mL）、SampleG（200mL）、Leaf&（200mL）などがあります。(샘플)",
    citations: [["https://item.rakuten.co.jp/sample-shop/sample-a-lotion", "SampleA ドクダミ化粧水 250mL"]],
  },
  {
    engine: "gemini",
    query: Q_VALUE,
    concern: null,
    answer: "SampleA と SampleG は容量あたりの価格が手頃です。(샘플)",
    citations: [],
  },
  {
    engine: "perplexity",
    query: Q_VALUE,
    concern: null,
    answer: "mLあたりの価格で比べると SampleA が最も安く、次いで SampleG です。どちらも大容量ボトルです。(샘플)",
    citations: [["https://the360.life/sample-ldk-value", "コスパ化粧水 比較"]],
  },
];

const dictionary = brandDictionary(
  OWN_BRAND,
  products.map((p) => p.brand),
);

export const geoSnapshots = parseAll(
  GeoSnapshot,
  rows.map((r, i) => {
    // llm 항목은 원문에 있어야 한다 (실제 분석과 같은 대조). 없으면 빌드에서 걸린다
    for (const t of [...(r.llmBrands ?? []), ...(r.llmKeywords ?? [])]) {
      if (!verifyInAnswer(r.answer, t)) throw new Error(`가짜 데이터 검증 실패: geo ${r.engine}·${r.query}의 ${t}가 답변에 없음`);
    }
    const brand_mentions = rankMentions(r.answer, [
      ...detectBrands(r.answer, dictionary),
      ...(r.llmBrands ?? []).map((b) => ({ brand: b, matched_text: b, source: "llm" as const })),
    ]);
    const hasLlm = (r.llmBrands?.length ?? 0) + (r.llmKeywords?.length ?? 0) > 0;
    return {
      id: `geo-${i + 1}`,
      workspace_id: WORKSPACE_ID,
      created_at: ts("2026-10-20", ENGINE_TIMES[r.engine]),
      engine: r.engine,
      model: MODEL[r.engine],
      prompt_version: hasLlm ? "geo-extract.v1" : null,
      category: CATEGORY_OF(r.query),
      query: r.query,
      query_concern: r.concern,
      run_index: r.run ?? 1,
      answer: r.answer,
      brands_mentioned: brand_mentions.map((m) => m.brand),
      brand_mentions,
      citations: r.citations.map(([url, title]) => ({ url, domain: domainOf(url), title })),
      keywords: [...detectKeywords(r.answer, CATEGORY_OF(r.query)), ...(r.llmKeywords ?? []).map((k) => ({ keyword: k, matched_text: k, source: "llm" as const }))],
      captured_at: ts("2026-10-20", ENGINE_TIMES[r.engine]),
    };
  }),
  "geoSnapshots",
);
