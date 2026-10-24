// 랭킹 항목의 상세 값(상품 설명·용량·평점·프로모션·배지) 샘플.
// 楽天·Qoo10 상품 페이지의 항목 구성만 흉내 낸 합성 값이다. 제품마다 고정이라 주가 바뀌어도 같다
import type { PromoHookType, RankingItem } from "@/lib/schemas/trend";
import { readListing } from "@/lib/schemas/product";
import type { Banner } from "./appeal-samples";
import { products } from "./products";

/** 상품명 한국어 해석 */
const NAME_KO: Record<string, string> = {
  "ドクダミ化粧水": "어성초 화장수",
  "薬用ローション": "약용 로션",
  "セラミドトナー": "세라마이드 토너",
  "ヒアルロン酸ローション": "히알루론산 로션",
  "高保湿化粧水": "고보습 화장수",
  "拭き取り化粧水": "닦아내는 화장수",
  "パンテノールトナー": "판테놀 토너",
  "ライストナー": "라이스(쌀) 토너",
  "うるおいローション": "수분 로션",
  "毛穴ケアトナー": "모공 케어 토너",
  "しっとり化粧水": "촉촉한 화장수",
  "シカトナー": "시카 토너",
  "敏感肌用化粧水": "민감 피부용 화장수",
  "ビタミントナー": "비타민 토너",
  "導入化粧水": "부스터 화장수",
  "アゼライン酸トナー": "아젤라산 토너",
  "PDRNトナー": "PDRN 토너",
  "酵素化粧水": "효소 화장수",
  "グリーンティートナー": "녹차 토너",
  "ハトムギローション": "율무 로션",
  "ガラクトミセストナー": "갈락토미세스 토너",
  "ペプチドトナー": "펩타이드 토너",
  "弱酸性化粧水": "약산성 화장수",
  "ミルクトナー": "밀크 토너",
  "オイルインローション": "오일 인 로션",
  "ブライトニングトナー": "브라이트닝 토너",
  "ニードルトナー": "니들 토너",
  "ドクダミパッドトナー": "어성초 패드 토너",
  "セラミド化粧水": "세라마이드 화장수",
  "ビタミンCローション": "비타민C 로션",
  "ハトムギ化粧水": "율무 화장수",
  "アミノ酸化粧水": "아미노산 화장수",
  "ドクダミトナー": "어성초 토너",
  "ナイアシンアミドトナー": "나이아신아마이드 토너",
  "米発酵化粧水": "쌀 발효 화장수",
  "CICAトナー": "시카 토너",
  "とろみ保湿ローション": "쫀쫀한 보습 로션",
  "セラミドアンプル": "세라마이드 앰플",
  "ナイアシンアミド美容液": "나이아신아마이드 미용액",
  "レチノールセラム": "레티놀 세럼",
  "ビタミンC美容液": "비타민C 미용액",
  "ビタミン美容液": "비타민 미용액",
  "導入美容液": "부스터 미용액",
  "ドクダミアンプル": "어성초 앰플",
  "ハリ美容液": "탄력 미용액",
  "シカアンプル": "시카 앰플",
  "高保湿セラム": "고보습 세럼",
  "ペプチドセラム": "펩타이드 세럼",
  "毛穴美容液": "모공 미용액",
  "美容オイル": "페이스 오일",
  "ヒアルロン酸アンプル": "히알루론산 앰플",
  "グルタチオン美容液": "글루타치온 미용액",
  "エクソソームアンプル": "엑소좀 앰플",
  "スクワランオイル": "스쿠알란 오일",
  "トラネキサム酸美容液": "트라넥삼산 미용액",
  "ナイアシン導入液": "나이아신 부스터",
  "ビタミンAセラム": "비타민A 세럼",
  "発酵エッセンス": "발효 에센스",
  "アゼライン酸セラム": "아젤라산 세럼",
  "マイクロニードル美容液": "마이크로니들 미용액",
  "保湿ブースター": "보습 부스터",
  "ハーブアンプル": "허브 앰플",
  "保湿クリーム": "보습 크림",
  "シカクリーム": "시카 크림",
  "セラミドクリーム": "세라마이드 크림",
  "パンテノールクリーム": "판테놀 크림",
  "オールインワンジェル": "올인원 젤",
  "夜用クリーム": "나이트 크림",
  "水分クリーム": "수분 크림",
  "バームクリーム": "밤 크림",
  "ナイトマスク": "나이트 마스크",
  "バリアクリーム": "장벽 크림",
  "敏感肌クリーム": "민감 피부 크림",
  "ビタミンクリーム": "비타민 크림",
  "PDRNクリーム": "PDRN 크림",
  "エクソソームクリーム": "엑소좀 크림",
  "ペプチドクリーム": "펩타이드 크림",
  "ドクダミクリーム": "어성초 크림",
  "尿素クリーム": "요소 크림",
  "ジェルクリーム": "젤 크림",
  "ナイアシンクリーム": "나이아신 크림",
  "スクワランバーム": "스쿠알란 밤",
  "トーンアップクリーム": "톤업 크림",
  "レチノールクリーム": "레티놀 크림",
  "アイクリーム": "아이크림",
  "ハンドバーム": "핸드 밤",
  "ミルククリーム": "밀크 크림",
  "グリーンティークリーム": "녹차 크림",
};

/** 고정 해시 (제품마다 같은 값을 고르기 위해) */
function hash(text: string): number {
  let h = 7;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 1_000_003;
  return h;
}

const VOLUMES: Record<string, number[]> = { "化粧水": [150, 200, 250, 300, 500], "美容液": [20, 30, 50], "クリーム": [50, 60, 80] };
const MINI_ML: Record<string, number> = { "化粧水": 30, "美容液": 5, "クリーム": 10 };

// 설명에 넣는 소구 문구 후보 (lib/market-config.ts APPEAL_TAGS의 표기와 겹치게 쓴다)
const APPEAL_PHRASES = ["うるおいを与える", "低刺激処方", "毛穴を引きしめる", "透明感のある肌へ", "ハリ・ツヤを与える", "ゆらぎがちな肌に", "無香料", "アルコールフリー", "弱酸性"];

// 설명에 넣는 배합 성분 표기 (全成分 표기 방식). 성분 관심도는 이 표기를 사전(INGREDIENT_MATCH)과 대조해 센다
const FORMULA_INGREDIENTS = ["ヒアルロン酸Na", "セラミドNP", "ナイアシンアミド", "ツボクサエキス", "レチノール", "アスコルビルグルコシド", "ドクダミエキス", "パンテノール", "トラネキサム酸", "スクワラン"];

const PROMOS: [PromoHookType, string][] = [
  ["bundle", "2本セット"],
  ["discount", "期間限定10%OFF"],
  ["limited", "数量限定"],
  ["gift", "同品ミニサイズ付き"],
];

type Detail = Pick<RankingItem, "product_id" | "name_ko" | "description_ja" | "volume_ml" | "extra_volume_ml" | "rating" | "rating_scale" | "promo_type" | "promo_text" | "badges">;

/**
 * brand·name·카테고리로 상세 값을 만든다. products에 같은 제품이 있으면 그 용량·평점을 쓰고,
 * 이미지 분석 샘플(banner)이 있으면 그 프로모션 문구를 쓴다 (화면끼리 값이 어긋나지 않게)
 */
export function rankingDetail(brand: string, name: string, category: string, banner?: Banner): Detail {
  const h = hash(`${brand}|${name}`);
  const product = products.find((p) => p.brand === brand && p.name === name);
  const listing = product ? readListing(product) : null;
  const volume = product?.volume_ml ?? VOLUMES[category][h % VOLUMES[category].length];

  const hook = banner?.hooks[0];
  const [promo_type, promo_text] = banner ? (hook ?? [null, null]) : h % 5 === 4 ? [null, null] : PROMOS[h % 4];
  // 같은 제품 미니어처를 주는 경우만 총 용량에 더한다
  const sameProductMini = promo_type === "gift" && (promo_text === "同品ミニサイズ付き" || promo_text === "ミニサイズおまけ付き");

  const awardHook = banner?.hooks.find(([type]) => type === "award");
  const badges = awardHook ? [awardHook[1]] : h % 9 === 0 ? ["ランキング1位獲得"] : h % 13 === 0 ? ["ベストコスメ受賞"] : [];

  const texture = /しっとり|高保湿|クリーム|バーム|オイル/.test(name) ? "しっとり" : /拭き取り|毛穴|ビタミン|ジェル/.test(name) ? "さっぱり" : h % 2 === 0 ? "さっぱり" : "しっとり";
  const phrases = [APPEAL_PHRASES[h % APPEAL_PHRASES.length], APPEAL_PHRASES[Math.floor(h / 7) % APPEAL_PHRASES.length]];
  // 등록된 제품은 전성분에 있는 성분만 설명에 쓴다 (설명과 전성분이 어긋나지 않게)
  const formulaName = product ? product.ingredients.find((x) => FORMULA_INGREDIENTS.includes(x)) : h % 10 < 6 ? FORMULA_INGREDIENTS[Math.floor(h / 11) % FORMULA_INGREDIENTS.length] : undefined;
  const formula = formulaName ? `${formulaName}配合` : null;
  const description_ja = [name, `${texture}とした使い心地`, formula, ...new Set(phrases), volume >= 300 ? "大容量" : null].filter(Boolean).join("。") + "。";

  return {
    product_id: product?.id ?? null,
    name_ko: NAME_KO[name],
    description_ja,
    volume_ml: volume,
    ...(sameProductMini ? { extra_volume_ml: MINI_ML[category] } : {}),
    rating: listing?.rating ?? Math.round((3.8 + (h % 10) / 10) * 10) / 10,
    rating_scale: listing?.rating_scale ?? 5,
    promo_type,
    promo_text,
    badges,
  };
}
