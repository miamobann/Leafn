import { ownProductImage, ownProductName, type OwnProductId } from "@/lib/own-products";

// Qoo10 상세페이지(설문 결과의 「購入する」로 들어옴). 판매 중인 건성 라인 2종만 있다.
// 구성은 콘텐츠 제작 보고서(상세페이지 12장)를 따르고, 문구는 약기법 기준 자료(knowledge/yakkiho)와 대조했다.
//  - 02 사회적 증거(순위 · 수상 · 후기 수)는 근거 자료가 없어 넣지 않는다 (F8.2, E22)
//  - 성분은 배합 목적(保湿成分)을 붙이고 판테놀은 뺀다 (E24, 팀 결정 2026-10-23)
//  - 「角質層まで」는 침투 범위를 각질층으로 밝힌 표현만 쓴다 (E3)
//  - 리뷰 말풍선은 사용감 표현만 (E20). 실제 판매 때는 실제 리뷰로 바꿔야 한다
// 가격 · 용량은 다른 탭과 같게 lib/mock/products.ts 값을 쓰고, 전성분은 팀 CSV(가상 목록)에서 판테놀을 뺀 것이다

export const SHOP_PRODUCT_IDS = ["deep-skin", "core-essence"] as const satisfies readonly OwnProductId[];
export type ShopProductId = (typeof SHOP_PRODUCT_IDS)[number];

export type ShopContent = {
  kind: string;
  /** Qoo10 상품명 줄 */
  title: string;
  gallery: { src: string; alt: string }[];
  hook: { src: string; alt: string };
  worry: string[];
  points: { text: string; icon: "droplets" | "wind" | "calendar" | "hand" }[];
  ingredients: string[];
  texture: string[];
  howTo: string;
  reviews: string[];
  fullIngredients: string;
};

const DRY_POSTER = {
  src: "/products/posters/leaf-dew-dry-poster.webp",
  alt: "乾燥しがちな肌に、たっぷりのうるおいを。化粧水とエッセンスで、肌の乾燥を防ぐ毎日のケア。",
};

export const SHOP_CONTENT: Record<ShopProductId, ShopContent> = {
  "deep-skin": {
    kind: "化粧水",
    title: `${ownProductName("deep-skin")} 化粧水 保湿成分ヒアルロン酸Na配合`,
    gallery: [
      { src: ownProductImage("deep-skin"), alt: `${ownProductName("deep-skin")}と${ownProductName("core-essence")}` },
      DRY_POSTER,
    ],
    hook: DRY_POSTER,
    worry: ["洗顔後、すぐにつっぱる。", "乾燥が気になる季節、こんなお悩みありませんか？"],
    points: [
      { text: "角質層まで※うるおう", icon: "droplets" },
      { text: "べたつかない", icon: "wind" },
      { text: "毎日使いやすい", icon: "calendar" },
    ],
    ingredients: ["ヒアルロン酸Na", "グリセリン"],
    texture: ["さっぱり、すーっとなじむ。", "べたつかないのに、しっとり。"],
    howTo: "洗顔後、適量を手に取り顔全体になじませてください。",
    reviews: ["しっとりするのにべたつかない", "香りが控えめで毎日使いやすい", "メイク前にもなじみやすい"],
    fullIngredients:
      "水、BG、グリセリン、プロパンジオール、ヒアルロン酸Na、ベタイン、アラントイン、ヒドロキシエチルセルロース、クエン酸、クエン酸Na、EDTA-2Na、エチルヘキシルグリセリン、フェノキシエタノール",
  },
  "core-essence": {
    kind: "美容液",
    title: `${ownProductName("core-essence")} 美容液 保湿成分セラミドNP配合`,
    gallery: [
      { src: ownProductImage("core-essence"), alt: `${ownProductName("deep-skin")}と${ownProductName("core-essence")}` },
      DRY_POSTER,
    ],
    hook: DRY_POSTER,
    worry: ["化粧水だけでは、乾燥が気になる。", "うるおいを守るひと手間、足りていますか？"],
    points: [
      { text: "角質層まで※うるおう", icon: "droplets" },
      { text: "なめらかになじむ", icon: "hand" },
      { text: "化粧水のあとに1プッシュ", icon: "calendar" },
    ],
    ingredients: ["ヒアルロン酸Na", "セラミドNP", "コレステロール", "ステアリン酸"],
    texture: ["みずみずしいのに、しっとり。", "肌になめらかになじむ。"],
    howTo: "化粧水のあと、1〜2プッシュを手に取り顔全体になじませてください。",
    reviews: ["しっとりするのに重くない", "化粧水のあとに使いやすい", "ポンプで出しやすい"],
    fullIngredients:
      "水、BG、グリセリン、プロパンジオール、スクワラン、トリ（カプリル酸／カプリン酸）グリセリル、ヒアルロン酸Na、セラミドNP、コレステロール、ステアリン酸、水添レシチン、カルボマー、アルギニン、EDTA-2Na、エチルヘキシルグリセリン、フェノキシエタノール",
  },
};

export const CAUTION =
  "お肌に異常が生じていないかよく注意して使用してください。使用中または使用後に赤み、はれ、かゆみ、刺激等の異常があらわれた場合は使用を中止し、皮膚科専門医等にご相談ください。";
