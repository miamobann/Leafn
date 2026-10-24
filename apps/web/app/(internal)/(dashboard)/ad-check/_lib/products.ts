// Leaf& Dew 제품 4종. 이름은 lib/own-products.ts (docs/Product.md 기준), 제품 구분(一般化粧品)은 2026-10-23 확정, 전성분·용량은 가상 데이터. 출처: 팀이 만든 leaf_and_japan_marketing_test_data.csv
// id는 공용 products(lib/mock/products.ts)의 자사 제품 id와 같다. 광고 검토에 필요한 전성분(한국어·INCI·일본어)·용기는 여기에만 있다.
import { z } from "zod";
import { ProductCategory } from "@/lib/schemas/ad-check";
import { ownProductName } from "@/lib/own-products";

export const LabIngredient = z.object({
  ko: z.string(),
  inci: z.string(),
  /** 일본어 표시명(가칭). 확인 전 */
  ja: z.string(),
});

export const LabProduct = z.object({
  id: z.string(),
  name_ko: z.string(),
  name_ja: z.string(),
  line: z.string(),
  launch_status: z.enum(["live", "developing"]),
  /** 일본 제품 구분. 미정이면 null */
  product_category: ProductCategory.nullable(),
  /** 용량 (큐텐 상품명에 넣는 표기, 예: 200ml). 가상 */
  volume: z.string(),
  /** 큐텐 판매가 (세금 포함, 엔). 가상 가격표 2026-10-24 */
  price_jpy: z.number().int().positive(),
  container: z.string(),
  ingredients: z.array(LabIngredient),
});
export type LabProduct = z.infer<typeof LabProduct>;

export const LAB_PRODUCTS: unknown[] = [
  {
    id: "p-own-1",
    name_ko: ownProductName("deep-skin"),
    name_ja: ownProductName("deep-skin"),
    line: "건성 스킨",
    launch_status: "live",
    product_category: "general_cosmetic",
    volume: "200ml",
    price_jpy: 2480,
    container: "플라스틱 통형",
    ingredients: [
      { ko: "히알루론산나트륨", inci: "Sodium Hyaluronate", ja: "ヒアルロン酸Na" },
      { ko: "글리세린", inci: "Glycerin", ja: "グリセリン" },
      { ko: "판테놀", inci: "Panthenol", ja: "パンテノール" },
      { ko: "정제수", inci: "Water", ja: "水" },
      { ko: "부틸렌글라이콜", inci: "Butylene Glycol", ja: "BG" },
      { ko: "프로판다이올", inci: "Propanediol", ja: "プロパンジオール" },
      { ko: "베타인", inci: "Betaine", ja: "ベタイン" },
      { ko: "알란토인", inci: "Allantoin", ja: "アラントイン" },
      { ko: "하이드록시에틸셀룰로오스", inci: "Hydroxyethylcellulose", ja: "ヒドロキシエチルセルロース" },
      { ko: "다이소듐이디티에이", inci: "Disodium EDTA", ja: "EDTA-2Na" },
      { ko: "페녹시에탄올", inci: "Phenoxyethanol", ja: "フェノキシエタノール" },
      { ko: "에틸헥실글리세린", inci: "Ethylhexylglycerin", ja: "エチルヘキシルグリセリン" },
      { ko: "시트릭애씨드", inci: "Citric Acid", ja: "クエン酸" },
      { ko: "소듐시트레이트", inci: "Sodium Citrate", ja: "クエン酸Na" },
    ],
  },
  {
    id: "p-own-2",
    name_ko: ownProductName("core-essence"),
    name_ja: ownProductName("core-essence"),
    line: "건성 에센스",
    launch_status: "live",
    product_category: "general_cosmetic",
    volume: "50ml",
    price_jpy: 2980,
    container: "유리 펌프형",
    ingredients: [
      { ko: "히알루론산나트륨", inci: "Sodium Hyaluronate", ja: "ヒアルロン酸Na" },
      { ko: "세라마이드 NP", inci: "Ceramide NP", ja: "セラミドNP" },
      { ko: "콜레스테롤", inci: "Cholesterol", ja: "コレステロール" },
      { ko: "스테아릭애씨드", inci: "Stearic Acid", ja: "ステアリン酸" },
      { ko: "글리세린", inci: "Glycerin", ja: "グリセリン" },
      { ko: "정제수", inci: "Water", ja: "水" },
      { ko: "부틸렌글라이콜", inci: "Butylene Glycol", ja: "BG" },
      { ko: "프로판다이올", inci: "Propanediol", ja: "プロパンジオール" },
      { ko: "스쿠알란", inci: "Squalane", ja: "スクワラン" },
      { ko: "카프릴릭/카프릭트라이글리세라이드", inci: "Caprylic/Capric Triglyceride", ja: "トリ（カプリル酸／カプリン酸）グリセリル" },
      { ko: "하이드로제네이티드레시틴", inci: "Hydrogenated Lecithin", ja: "水添レシチン" },
      { ko: "카보머", inci: "Carbomer", ja: "カルボマー" },
      { ko: "아르기닌", inci: "Arginine", ja: "アルギニン" },
      { ko: "다이소듐이디티에이", inci: "Disodium EDTA", ja: "EDTA-2Na" },
      { ko: "페녹시에탄올", inci: "Phenoxyethanol", ja: "フェノキシエタノール" },
      { ko: "에틸헥실글리세린", inci: "Ethylhexylglycerin", ja: "エチルヘキシルグリセリン" },
    ],
  },
  {
    id: "p-own-3",
    name_ko: ownProductName("tea-pure-skin"),
    name_ja: ownProductName("tea-pure-skin"),
    line: "지성 스킨",
    launch_status: "developing",
    product_category: "general_cosmetic",
    volume: "150ml",
    price_jpy: 2480,
    container: "미정",
    ingredients: [
      { ko: "히알루론산나트륨", inci: "Sodium Hyaluronate", ja: "ヒアルロン酸Na" },
      { ko: "판테놀", inci: "Panthenol", ja: "パンテノール" },
      { ko: "녹차추출물", inci: "Camellia Sinensis Leaf Extract", ja: "チャ葉エキス" },
    ],
  },
  {
    id: "p-own-4",
    name_ko: ownProductName("mild-skin"),
    name_ja: ownProductName("mild-skin"),
    line: "복합성 스킨",
    launch_status: "developing",
    product_category: "general_cosmetic",
    volume: "150ml",
    price_jpy: 2480,
    container: "미정",
    ingredients: [
      { ko: "히알루론산나트륨", inci: "Sodium Hyaluronate", ja: "ヒアルロン酸Na" },
      { ko: "글리세린", inci: "Glycerin", ja: "グリセリン" },
      { ko: "베타인", inci: "Betaine", ja: "ベタイン" },
    ],
  },
];

/** 불러올 때 Zod로 검증한다 (CLAUDE.md 4장 lib/mock 규칙과 같다) */
export const PRODUCTS: LabProduct[] = z.array(LabProduct).parse(LAB_PRODUCTS);
