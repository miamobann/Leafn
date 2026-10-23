import { Product } from "@/lib/schemas/product";
import { parseAll, ts, WORKSPACE_ID } from "./helpers";

// Qoo10 카테고리 랭킹 TOP10 (가상 브랜드). 순위는 수집 API가 주는 값이라 source_raw에 둔다 (DB_RULES 2.1)
// [순위, 브랜드, 상품명, 税込 가격, 용량 ml, 全成分(앞부분), 특징]
type RankSeed = [number, string, string, number, number, string[], string[]];

const qoo10Toner: RankSeed[] = [
  [1, "SampleD", "ヒアルロン酸ローション", 1980, 300, ["水", "BG", "ヒアルロン酸Na", "グリセリン"], ["보습", "대용량"]],
  [2, "SampleE", "セラミド化粧水", 2750, 200, ["水", "グリセリン", "セラミドNP", "スクワラン"], ["장벽", "보습"]],
  [3, "SampleF", "ビタミンCローション", 2420, 150, ["水", "BG", "アスコルビルグルコシド", "エタノール"], ["톤 정돈"]],
  [4, "SampleG", "ハトムギ化粧水", 1580, 500, ["水", "ハトムギ種子エキス", "BG", "エタノール"], ["대용량", "산뜻"]],
  [5, "SampleH", "アミノ酸化粧水", 2200, 200, ["水", "グリセリン", "アルギニン", "セリン"], ["저자극"]],
  [6, "SampleI", "ドクダミトナー", 2090, 250, ["ドクダミエキス", "水", "BG", "ペンチレングリコール"], ["진정"]],
  [7, "SampleJ", "ナイアシンアミドトナー", 2640, 200, ["水", "ナイアシンアミド", "グリセリン", "香料"], ["결 정돈"]],
  [8, "SampleK", "米発酵化粧水", 2980, 150, ["コメ発酵液", "水", "グリセリン", "BG"], ["보습", "발효"]],
  [9, "SampleL", "CICAトナー", 1890, 250, ["水", "ツボクサエキス", "BG", "香料"], ["진정"]],
  [10, "SampleM", "とろみ保湿ローション", 3300, 200, ["水", "DPG", "グリセリン", "ヒアルロン酸Na"], ["고보습", "쫀쫀"]],
];

const qoo10Serum: RankSeed[] = [
  [1, "SampleN", "レチノールセラム", 3520, 30, ["水", "BG", "レチノール", "スクワラン"], ["탄력"]],
  [2, "SampleO", "ビタミンC美容液", 2980, 30, ["水", "アスコルビン酸", "エタノール", "BG"], ["톤 정돈"]],
  [3, "SampleP", "ナイアシンアミドセラム", 2480, 50, ["水", "ナイアシンアミド", "グリセリン", "香料"], ["결 정돈"]],
  [4, "SampleQ", "PDRNアンプル", 4400, 30, ["水", "グリセリン", "ナトリウムDNA", "BG"], ["재생 케어"]],
  [5, "SampleR", "ヒアルロン酸アンプル", 1980, 50, ["水", "BG", "ヒアルロン酸Na", "グリセリン"], ["보습"]],
  [6, "SampleS", "CICAアンプル", 2200, 50, ["ツボクサエキス", "水", "BG", "香料"], ["진정"]],
  [7, "SampleT", "ペプチドセラム", 3850, 30, ["水", "グリセリン", "パルミトイルトリペプチド-5", "BG"], ["탄력"]],
  [8, "SampleU", "グルタチオン美容液", 3300, 30, ["水", "グルタチオン", "BG", "エタノール"], ["톤 정돈"]],
  [9, "SampleV", "発酵エッセンス", 2750, 50, ["ガラクトミセス培養液", "水", "BG", "グリセリン"], ["발효", "보습"]],
  [10, "SampleW", "アゼライン酸セラム", 2640, 30, ["水", "アゼライン酸", "BG", "エタノール"], ["피지 케어"]],
];

const rankingProducts = (seeds: RankSeed[], prefix: string, category: string) =>
  seeds.map(([rank, brand, name, price_jpy, volume_ml, ingredients, features]) => ({
    id: `${prefix}-${String(rank).padStart(2, "0")}`,
    kind: "competitor",
    brand,
    name,
    platform: "qoo10",
    price_jpy,
    volume_ml,
    ingredients,
    features,
    category,
    source_raw: { qoo10_rank: rank, ranking: category, captured_at: "2026-10-20" },
  }));

// 가상 브랜드. 가격은 세금 포함 총액(税込), 성분은 全成分 표기 순서를 흉내 낸 샘플
export const products = parseAll(
  Product,
  [
    {
      id: "p-own-1",
      kind: "own",
      brand: "Leafn",
      name: "Leaf& Dew Deep Skin",
      platform: "qoo10",
      price_jpy: 2480,
      volume_ml: 200,
      ingredients: ["水", "グリセリン", "ヒアルロン酸Na", "加水分解ヒアルロン酸", "パンテノール"],
      features: ["히알루론산", "산뜻한 보습"],
      category: "化粧水",
    },
    {
      id: "p-own-2",
      kind: "own",
      brand: "Leafn",
      name: "Leaf& Dew Core Essence",
      platform: "qoo10",
      price_jpy: 2980,
      volume_ml: 50,
      ingredients: ["水", "BG", "ヒアルロン酸Na", "アセチルヒアルロン酸Na", "グリセリン"],
      features: ["히알루론산", "가벼운 제형"],
      category: "美容液",
    },
    {
      id: "p-comp-1",
      kind: "competitor",
      brand: "SampleA",
      name: "ドクダミ化粧水",
      platform: "rakuten",
      price_jpy: 1980,
      volume_ml: 250,
      ingredients: ["水", "ドクダミエキス", "BG"],
      features: ["진정"],
      category: "化粧水",
    },
    {
      id: "p-comp-2",
      kind: "competitor",
      brand: "SampleB",
      name: "セラミドトナー",
      platform: "qoo10",
      price_jpy: 2750,
      volume_ml: 150,
      ingredients: ["水", "セラミドNP", "グリセリン"],
      features: ["보습", "장벽"],
      category: "化粧水",
    },
    {
      id: "p-comp-3",
      kind: "competitor",
      brand: "SampleC",
      name: "ビタCトナー",
      platform: "rakuten",
      price_jpy: 3300,
      volume_ml: 120,
      ingredients: ["水", "アスコルビン酸", "BG"],
      features: ["톤 정돈"],
      category: "化粧水",
    },
    ...rankingProducts(qoo10Toner, "p-qsk", "化粧水"),
    ...rankingProducts(qoo10Serum, "p-qes", "美容液"),
  ].map((p) => ({
    url: null,
    image_path: null,
    source_raw: null,
    price_kind: "regular",
    ...p,
    workspace_id: WORKSPACE_ID,
    created_at: ts("2026-10-10"),
  })),
  "products",
);
