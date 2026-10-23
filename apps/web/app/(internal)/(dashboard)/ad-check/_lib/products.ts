// Leaf& Dew 제품 4종. 제품명·제품 구분(一般化粧品)은 2026-10-23 확정, 전성분·용량은 가상 데이터. 출처: 팀이 만든 leaf_and_japan_marketing_test_data.csv
// 공용 products(TAB 2 담당)를 건드리지 않으려고 탭 안에 둔다.
// products 테이블이 생기면 TAB 2 담당자와 합의해 lib/mock/products.ts(또는 DB)로 옮긴다.
import { z } from "zod";
import { ProductCategory } from "@/lib/schemas/ad-check";

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
  volume: z.string(),
  container: z.string(),
  ingredients: z.array(LabIngredient),
});
export type LabProduct = z.infer<typeof LabProduct>;

export const LAB_PRODUCTS: unknown[] = [
  {
    id: "leaf-dry-skin",
    name_ko: "Leaf& Dew Deep Skin",
    name_ja: "Leaf& Dew Deep Skin",
    line: "건성 스킨",
    launch_status: "live",
    product_category: "general_cosmetic",
    volume: "가상 150 ml",
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
    id: "leaf-dry-essence",
    name_ko: "Leaf& Dew Core Essence",
    name_ja: "Leaf& Dew Core Essence",
    line: "건성 에센스",
    launch_status: "live",
    product_category: "general_cosmetic",
    volume: "가상 30 ml",
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
    id: "leaf-oily-skin",
    name_ko: "Leaf& Dew Tea-Pure Skin",
    name_ja: "Leaf& Dew Tea-Pure Skin",
    line: "지성 스킨",
    launch_status: "developing",
    product_category: "general_cosmetic",
    volume: "가상 150 ml (예정)",
    container: "미정",
    ingredients: [
      { ko: "히알루론산나트륨", inci: "Sodium Hyaluronate", ja: "ヒアルロン酸Na" },
      { ko: "판테놀", inci: "Panthenol", ja: "パンテノール" },
      { ko: "녹차추출물", inci: "Camellia Sinensis Leaf Extract", ja: "チャ葉エキス" },
    ],
  },
  {
    id: "leaf-combo-skin",
    name_ko: "Leaf& Dew Mild Skin",
    name_ja: "Leaf& Dew Mild Skin",
    line: "복합성 스킨",
    launch_status: "developing",
    product_category: "general_cosmetic",
    volume: "가상 150 ml (예정)",
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
