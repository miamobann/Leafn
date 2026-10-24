import type { PlatformId } from "@/lib/platforms";
import { Product } from "@/lib/schemas/product";
import { OWN_BRAND, ownProductImage, ownProductName } from "@/lib/own-products";
import { parseAll, ts, WORKSPACE_ID } from "./helpers";

// 가상 브랜드. 가격은 세금 포함 총액(税込), 성분은 全成分 표기 순서를 흉내 낸 샘플
// 자사 4(이름·사진은 lib/own-products.ts, 개발 중 2종 포함) + 경쟁 8 + Qoo10 랭킹 20. 자사 제품은 평점 정보가 없어 source_raw = null
// platform은 lib/platforms.ts의 slug. @cosme는 쓰지 않기로 해서 SampleC·SampleH는 楽天으로 옮기고 평점을 5점 척도로 환산했다 (2026-10-23)
// source_raw는 상품 페이지 추출 원본을 흉내 낸 값. 평점·리뷰 수·행사가는 여기서만 꺼내 쓴다 (lib/schemas/product.ts readListing)
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
    kind: "competitor" as const,
    brand,
    name,
    platform: "qoo10" as const,
    price_jpy,
    volume_ml,
    ingredients,
    features,
    category,
    source_raw: { qoo10_rank: rank, ranking: category, captured_at: "2026-10-20" },
  }));

type Seed = {
  id: string;
  kind: "own" | "competitor";
  brand: string;
  name: string;
  platform: PlatformId;
  price_jpy: number;
  volume_ml: number;
  ingredients: string[];
  features: string[];
  category: string;
  /** 자사 제품 사진 (lib/own-products.ts ownProductImage) */
  image_path?: string;
  listing?: { rating: number | null; rating_scale: number; review_count: number; sale_price_jpy: number | null; sale_label: string | null };
};

const seeds: Seed[] = [
  {
    id: "p-own-1",
    kind: "own",
    brand: OWN_BRAND,
    name: ownProductName("deep-skin"),
    image_path: ownProductImage("deep-skin"),
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
    brand: OWN_BRAND,
    name: ownProductName("core-essence"),
    image_path: ownProductImage("core-essence"),
    platform: "qoo10",
    price_jpy: 2980,
    volume_ml: 50,
    ingredients: ["水", "BG", "ヒアルロン酸Na", "アセチルヒアルロン酸Na", "グリセリン"],
    features: ["히알루론산", "가벼운 제형"],
    category: "美容液",
  },
  // 개발 중 2종 (광고 검토 TAB 3, 2026-10-23). 가격·용량은 정해지지 않아 가정값이다. 전성분은 광고 검토 탭 _lib/products.ts 의 일본어 표시명(가칭)
  {
    id: "p-own-3",
    kind: "own",
    brand: OWN_BRAND,
    name: ownProductName("tea-pure-skin"),
    image_path: ownProductImage("tea-pure-skin"),
    platform: "qoo10",
    price_jpy: 2480,
    volume_ml: 150,
    ingredients: ["ヒアルロン酸Na", "パンテノール", "チャ葉エキス"],
    features: ["산뜻함", "개발 중"],
    category: "化粧水",
  },
  {
    id: "p-own-4",
    kind: "own",
    brand: OWN_BRAND,
    name: ownProductName("mild-skin"),
    image_path: ownProductImage("mild-skin"),
    platform: "qoo10",
    price_jpy: 2480,
    volume_ml: 150,
    ingredients: ["ヒアルロン酸Na", "グリセリン", "ベタイン"],
    features: ["유수분 밸런스", "개발 중"],
    category: "化粧水",
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
    listing: { rating: 4.4, rating_scale: 5, review_count: 4210, sale_price_jpy: null, sale_label: null },
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
    listing: { rating: 4.5, rating_scale: 5, review_count: 2341, sale_price_jpy: 2200, sale_label: "メガ割" },
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
    listing: { rating: 3.7, rating_scale: 5, review_count: 864, sale_price_jpy: null, sale_label: null },
  },
  {
    id: "p-comp-4",
    kind: "competitor",
    brand: "SampleD",
    name: "セラミドアンプル",
    platform: "qoo10",
    price_jpy: 2640,
    volume_ml: 50,
    ingredients: ["水", "グリセリン", "セラミドNP", "セラミドAP", "フィトスフィンゴシン", "コレステロール", "スクワラン", "パンテノール", "フェノキシエタノール"],
    features: ["세라마이드 3종", "メガ割 세트 판매"],
    category: "美容液",
    listing: { rating: 4.6, rating_scale: 5, review_count: 3012, sale_price_jpy: 1990, sale_label: "メガ割" },
  },
  {
    id: "p-comp-5",
    kind: "competitor",
    brand: "SampleE",
    name: "ナイアシンアミド美容液",
    platform: "rakuten",
    price_jpy: 3300,
    volume_ml: 30,
    ingredients: ["水", "ナイアシンアミド", "BG", "グリセリン", "ヒアルロン酸Na", "トラネキサム酸", "アラントイン", "フェノキシエタノール"],
    features: ["일본 브랜드", "スポイト 용기"],
    category: "美容液",
    listing: { rating: 4.4, rating_scale: 5, review_count: 690, sale_price_jpy: null, sale_label: null },
  },
  {
    id: "p-comp-6",
    kind: "competitor",
    brand: "SampleF",
    name: "レチノールセラム",
    platform: "qoo10",
    price_jpy: 2890,
    volume_ml: 30,
    ingredients: ["水", "スクワラン", "レチノール", "トコフェロール", "BG", "グリセリン", "セラミドNP", "フェノキシエタノール"],
    features: ["레티놀 저농도 표기", "야간 사용 안내"],
    category: "美容液",
    listing: { rating: 4.1, rating_scale: 5, review_count: 1544, sale_price_jpy: 2390, sale_label: "メガ割" },
  },
  {
    id: "p-comp-7",
    kind: "competitor",
    brand: "SampleG",
    name: "ヒアルロン酸ローション",
    platform: "rakuten",
    price_jpy: 1650,
    volume_ml: 200,
    ingredients: ["水", "グリセリン", "BG", "ヒアルロン酸Na", "パンテノール", "ベタイン", "アラントイン", "フェノキシエタノール"],
    features: ["무향 표기", "200ml 대용량"],
    category: "化粧水",
    listing: { rating: 4.5, rating_scale: 5, review_count: 1890, sale_price_jpy: null, sale_label: null },
  },
  {
    id: "p-comp-8",
    kind: "competitor",
    brand: "SampleH",
    name: "ビタミンC美容液",
    platform: "rakuten",
    price_jpy: 3850,
    volume_ml: 20,
    ingredients: ["水", "3-O-エチルアスコルビン酸", "アスコルビルグルコシド", "BG", "グリセリン", "ユズ果実エキス", "フェノキシエタノール"],
    features: ["일본 브랜드", "비타민C 유도체 2종", "20ml 소용량"],
    category: "美容液",
    listing: { rating: 4.0, rating_scale: 5, review_count: 402, sale_price_jpy: null, sale_label: null },
  },
];

export const products = parseAll(
  Product,
  [
    ...seeds.map(({ listing, ...p }) => ({
      url: `https://example.jp/items/${p.id}`,
      image_path: null,
      price_kind: "regular",
      ...p,
      source_raw: listing
        ? {
            ...listing,
            raw_title: `${p.brand} ${p.name}`,
            raw_price_text: `${p.price_jpy.toLocaleString("ja-JP")}円（税込）`,
            raw_volume_text: `${p.volume_ml}mL`,
            raw_ingredients_text: `全成分：${p.ingredients.join("、")}`,
            captured_at: ts("2026-10-20", "09:10"),
          }
        : null,
    })),
    ...[...rankingProducts(qoo10Toner, "p-qsk", "化粧水"), ...rankingProducts(qoo10Serum, "p-qes", "美容液")].map((p) => ({
      url: null,
      image_path: null,
      price_kind: "regular",
      ...p,
    })),
  ].map((p) => ({ ...p, workspace_id: WORKSPACE_ID, created_at: ts("2026-10-10") })),
  "products",
);
