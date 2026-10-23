import { Product } from "@/lib/schemas/product";
import { parseAll, ts, WORKSPACE_ID } from "./helpers";

// 가상 브랜드. 가격은 세금 포함 총액(税込), 성분은 全成分 표기 순서를 흉내 낸 샘플
// 자사 3 + 경쟁 8 (prototype-plan P3). p-own-2·3의 제품명과 성분은 팀 가상 데이터(Suyeon 브랜치 mock-products.ts) 기준
// source_raw는 상품 페이지 추출 원본을 흉내 낸 값. 평점·리뷰 수·행사가는 여기서만 꺼내 쓴다 (lib/schemas/product.ts readListing)
type Seed = {
  id: string;
  kind: "own" | "competitor";
  brand: string;
  name: string;
  platform: string;
  price_jpy: number;
  volume_ml: number;
  ingredients: string[];
  features: string[];
  category: string;
  listing: { rating: number | null; rating_scale: number; review_count: number; sale_price_jpy: number | null; sale_label: string | null };
};

const seeds: Seed[] = [
  {
    id: "p-own-1",
    kind: "own",
    brand: "Leafn",
    name: "시카 수분 토너",
    platform: "Qoo10",
    price_jpy: 2480,
    volume_ml: 200,
    ingredients: ["水", "ツボクサエキス", "グリセリン", "ナイアシンアミド"],
    features: ["저자극", "수분"],
    category: "化粧水",
    listing: { rating: 4.3, rating_scale: 5, review_count: 640, sale_price_jpy: 1980, sale_label: "メガ割" },
  },
  {
    id: "p-own-2",
    kind: "own",
    brand: "Leafn",
    name: "모이스트 밸런스 스킨",
    platform: "Qoo10",
    price_jpy: 2480,
    volume_ml: 150,
    ingredients: ["水", "BG", "グリセリン", "プロパンジオール", "ベタイン", "パンテノール", "ヒアルロン酸Na", "アラントイン", "ヒドロキシエチルセルロース", "クエン酸", "クエン酸Na", "EDTA-2Na", "エチルヘキシルグリセリン", "フェノキシエタノール"],
    features: ["히알루론산Na·글리세린·판테놀 배합", "건성 피부 라인", "150ml 통형 용기"],
    category: "化粧水",
    listing: { rating: 4.4, rating_scale: 5, review_count: 812, sale_price_jpy: 1980, sale_label: "メガ割" },
  },
  {
    id: "p-own-3",
    kind: "own",
    brand: "Leafn",
    name: "모이스트 리페어 에센스",
    platform: "楽天市場",
    price_jpy: 2980,
    volume_ml: 30,
    ingredients: ["水", "グリセリン", "BG", "プロパンジオール", "スクワラン", "トリ(カプリル酸/カプリン酸)グリセリル", "セラミドNP", "コレステロール", "ステアリン酸", "ヒアルロン酸Na", "水添レシチン", "カルボマー", "アルギニン", "EDTA-2Na", "エチルヘキシルグリセリン", "フェノキシエタノール"],
    features: ["세라마이드NP·콜레스테롤·스쿠알란 배합", "건성 피부 라인", "30ml 유리 펌프형"],
    category: "美容液",
    listing: { rating: 4.2, rating_scale: 5, review_count: 472, sale_price_jpy: null, sale_label: null },
  },
  {
    id: "p-comp-1",
    kind: "competitor",
    brand: "SampleA",
    name: "ドクダミ化粧水",
    platform: "楽天市場",
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
    platform: "Qoo10",
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
    platform: "@cosme SHOPPING",
    price_jpy: 3300,
    volume_ml: 120,
    ingredients: ["水", "アスコルビン酸", "BG"],
    features: ["톤 정돈"],
    category: "化粧水",
    listing: { rating: 5.2, rating_scale: 7, review_count: 864, sale_price_jpy: null, sale_label: null },
  },
  {
    id: "p-comp-4",
    kind: "competitor",
    brand: "SampleD",
    name: "セラミドアンプル",
    platform: "Qoo10",
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
    platform: "楽天市場",
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
    platform: "Qoo10",
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
    platform: "楽天市場",
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
    platform: "@cosme SHOPPING",
    price_jpy: 3850,
    volume_ml: 20,
    ingredients: ["水", "3-O-エチルアスコルビン酸", "アスコルビルグルコシド", "BG", "グリセリン", "ユズ果実エキス", "フェノキシエタノール"],
    features: ["일본 브랜드", "비타민C 유도체 2종", "20ml 소용량"],
    category: "美容液",
    listing: { rating: 5.6, rating_scale: 7, review_count: 402, sale_price_jpy: null, sale_label: null },
  },
];

export const products = parseAll(
  Product,
  seeds.map(({ listing, ...p }) => ({
    url: `https://example.jp/items/${p.id}`,
    image_path: null,
    price_kind: "regular",
    ...p,
    source_raw: {
      ...listing,
      raw_title: `${p.brand} ${p.name}`,
      raw_price_text: `${p.price_jpy.toLocaleString("ja-JP")}円（税込）`,
      raw_volume_text: `${p.volume_ml}mL`,
      raw_ingredients_text: `全成分：${p.ingredients.join("、")}`,
      captured_at: ts("2026-10-20", "09:10"),
    },
    workspace_id: WORKSPACE_ID,
    created_at: ts("2026-10-10"),
  })),
  "products",
);
