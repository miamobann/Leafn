// GEO 답변 분석용 사전과 찾기 함수 (순수 함수, AI 없음)
// 1차는 사전 대조(한·일·영 동의어 포함). 사전에 없는 말은 Step 2에서 LLM이 뽑고, 원문에 있는 것만 남긴다 (verifyInAnswer)
import { fold, INGREDIENT_ALIASES } from "@/lib/ai/appeal-normalize";
import type { SkinConcern } from "@/lib/schemas/trend";
import { OWN_BRAND } from "@/lib/own-products";

export type TermSource = "dictionary" | "llm";

/** 자사 브랜드 표기 흔들림 */
export const OWN_BRAND_ALIASES = ["Leaf&", "Leaf &", "リーフアンド"];

/** 결정 키워드 (AI가 추천 사유로 드는 말) · 통일 이름 → 표기 (ko는 자사 제품 정보의 한국어 특징과 대조할 때 쓴다) */
export const DECISIVE_KEYWORDS: Record<string, { ko: string; aliases: string[] }> = {
  "ノンコメドジェニックテスト済み": { ko: "논코메도제닉 테스트", aliases: ["ノンコメドジェニック", "논코메도제닉", "noncomedogenic"] },
  "アルコールフリー": { ko: "알코올 프리", aliases: ["アルコールフリー", "ノンアルコール", "エタノールフリー", "알코올 프리", "무알코올"] },
  "無香料": { ko: "무향료", aliases: ["無香料", "香料フリー", "フレグランスフリー", "무향", "fragrance free"] },
  "低刺激": { ko: "저자극", aliases: ["低刺激", "저자극"] },
  // 「パッチテストをおすすめします」(권유)는 제품 특징이 아니라서 「済」만 센다
  "パッチテスト済み": { ko: "패치 테스트 완료", aliases: ["パッチテスト済", "패치 테스트 완료"] },
  "敏感肌テスト済み": { ko: "민감 피부 테스트 완료", aliases: ["敏感肌テスト済", "민감 피부 테스트 완료"] },
  "弱酸性": { ko: "약산성", aliases: ["弱酸性", "약산성"] },
  "大容量": { ko: "대용량", aliases: ["大容量", "대용량"] },
  "@cosmeランキング": { ko: "@cosme 랭킹", aliases: ["@cosmeランキング", "@cosme ランキング", "アットコスメ"] },
  "ベストコスメ受賞": { ko: "베스트코스메 수상", aliases: ["ベストコスメ", "베스트코스메"] },
};

/** 카테고리마다 따로 보는 결정 키워드 (카테고리를 바꿔도 그 카테고리의 추천 사유를 놓치지 않게) */
export const CATEGORY_KEYWORDS: Record<string, Record<string, { ko: string; aliases: string[] }>> = {
  "化粧水": {
    "拭き取り": { ko: "닦토", aliases: ["拭き取り"] },
    "高保湿": { ko: "고보습", aliases: ["高保湿"] },
  },
  "美容液": {
    "高濃度": { ko: "고농축", aliases: ["高濃度", "고농축"] },
    "導入美容液": { ko: "부스터", aliases: ["導入", "ブースター", "부스터"] },
  },
  "クリーム": {
    "ベタつかない": { ko: "산뜻함", aliases: ["ベタつかない", "べたつかない", "さっぱり"] },
    "バリア機能": { ko: "장벽 케어", aliases: ["バリア機能", "バリア", "장벽"] },
  },
  "日焼け止め": {
    "SPF50+": { ko: "SPF50+", aliases: ["SPF50+", "SPF50＋"] },
    "PA++++": { ko: "PA++++", aliases: ["PA++++", "PA＋＋＋＋"] },
    "ノンケミカル": { ko: "무기자차", aliases: ["ノンケミカル", "紫外線吸収剤フリー", "紫外線吸収剤不使用", "무기자차"] },
    "白浮きしない": { ko: "백탁 없음", aliases: ["白浮きしない", "白浮きなし", "백탁"] },
    "ウォータープルーフ": { ko: "워터프루프", aliases: ["ウォータープルーフ", "워터프루프"] },
    "トーンアップ": { ko: "톤업", aliases: ["トーンアップ", "톤업"] },
    "石鹸オフ": { ko: "비누 세안", aliases: ["石鹸で落ちる", "石けんオフ", "石鹸オフ"] },
  },
  "クレンジング": {
    "W洗顔不要": { ko: "이중세안 불필요", aliases: ["W洗顔不要", "ダブル洗顔不要"] },
    "マツエク対応": { ko: "속눈썹 연장 OK", aliases: ["マツエク対応", "マツエクOK"] },
  },
};

/** GEO 질의를 만드는 카테고리와 카테고리별 피부 고민 (질의 = 고민 × 카테고리) */
export const GEO_CATEGORIES: { category: string; concerns: SkinConcern[] }[] = [
  { category: "化粧水", concerns: ["dryness", "sensitivity", "pores"] },
  { category: "美容液", concerns: ["pores", "dullness", "aging"] },
  { category: "クリーム", concerns: ["dryness", "sensitivity", "aging"] },
  { category: "日焼け止め", concerns: ["sensitivity", "oiliness", "dryness"] },
  { category: "クレンジング", concerns: ["pores", "sensitivity", "dryness"] },
];

const CONCERN_JA: Record<SkinConcern, string> = {
  pores: "毛穴ケア",
  acne: "ニキビ肌",
  dryness: "乾燥肌",
  sensitivity: "敏感肌",
  dullness: "くすみ肌",
  aging: "エイジングケア",
  redness: "赤み肌",
  oiliness: "脂性肌",
  other: "",
};

/** 소비자가 실제로 칠 법한 질문. 제품 정보는 넣지 않는다 (넣으면 측정이 오염된다) */
export function buildGeoQueries(category: string): { query: string; concern: SkinConcern }[] {
  const entry = GEO_CATEGORIES.find((c) => c.category === category);
  return (entry?.concerns ?? []).map((concern) => ({ query: `${CONCERN_JA[concern]}におすすめの韓国${category}は？`, concern }));
}

/** 실제 브랜드 표기 흔들림 (한·일·영). 사전에 없는 브랜드는 LLM 보조 추출 + 원문 대조로 잡는다 */
export const KNOWN_BRANDS: Record<string, string[]> = {
  Torriden: ["Torriden", "トリデン", "토리든"],
  Anua: ["Anua", "アヌア", "아누아"],
  VT: ["VT COSMETICS", "VTコスメティックス", "ブイティー"],
  medicube: ["medicube", "メディキューブ", "메디큐브"],
  "d'Alba": ["d'Alba", "dAlba", "ダルバ", "달바"],
  numbuzin: ["numbuzin", "ナンバーズイン", "넘버즈인"],
  COSRX: ["COSRX", "コスアールエックス", "코스알엑스"],
  "Round Lab": ["Round Lab", "ROUND LAB", "ラウンドラボ", "라운드랩"],
  Abib: ["Abib", "アビブ", "아비브"],
  SKIN1004: ["SKIN1004", "スキン1004"],
  "Dr.Jart+": ["Dr.Jart", "ドクタージャルト", "닥터자르트"],
  innisfree: ["innisfree", "イニスフリー", "이니스프리"],
  LANEIGE: ["LANEIGE", "ラネージュ", "라네즈"],
  MEDIHEAL: ["MEDIHEAL", "メディヒール", "메디힐"],
  "Beauty of Joseon": ["Beauty of Joseon", "朝鮮美女", "조선미녀"],
  Isntree: ["Isntree", "イズントリー", "이즈앤트리"],
  "ma:nyo": ["ma:nyo", "manyo", "魔女工場", "마녀공장"],
  BIODANCE: ["BIODANCE", "バイオダンス", "바이오던스"],
  "I'm From": ["I'm From", "アイムフロム", "아임프롬"],
  "肌ラボ": ["肌ラボ", "Hada Labo", "ハダラボ"],
  "キュレル": ["キュレル", "Curel", "Curél"],
  "ミノン": ["ミノン", "MINON"],
  "無印良品": ["無印良品", "MUJI"],
  "ナチュリエ": ["ナチュリエ", "ハトムギ化粧水", "naturie"],
  "雪肌精": ["雪肌精", "SEKKISEI"],
  "オルビス": ["オルビス", "ORBIS"],
  MISSHA: ["MISSHA", "ミシャ", "미샤"],
  TONYMOLY: ["TONYMOLY", "TONY MOLY", "トニーモリー", "토니모리"],
  ETUDE: ["ETUDE", "エチュード", "에뛰드"],
  "Nature Republic": ["Nature Republic", "ネイチャーリパブリック", "네이처리퍼블릭"],
  SKINFOOD: ["SKINFOOD", "SKIN FOOD", "スキンフード", "스킨푸드"],
  Klairs: ["Klairs", "クレアス", "클레어스"],
  "A'pieu": ["A'pieu", "APIEU", "アピュ", "エイプル", "어퓨"],
  Aprilskin: ["Aprilskin", "エイプリルスキン", "에이프릴스킨"],
  Benton: ["Benton", "ベントン", "벤튼"],
  PURITO: ["PURITO", "ピュリト", "퓨리토"],
  Banobagi: ["Banobagi", "バノバギ", "바노바기"],
  KLAVUU: ["KLAVUU", "クラビュー", "클라뷰"],
  "rom&nd": ["rom&nd", "romand", "ロムアンド", "롬앤"],
  "Holika Holika": ["Holika Holika", "ホリカホリカ", "홀리카홀리카"],
  Sulwhasoo: ["Sulwhasoo", "雪花秀", "ソルファス", "설화수"],
  AHC: ["AHC", "エーエイチシー"],
};

/** 성분도 결정 키워드로 센다 (성분 관심도와 같은 사전) */
const INGREDIENT_KEYWORDS: Record<string, { ko: string; aliases: string[] }> = Object.fromEntries(
  Object.entries(INGREDIENT_ALIASES).map(([name, aliases]) => [name, { ko: name, aliases }]),
);

export const KEYWORD_DICTIONARY: Record<string, { ko: string; aliases: string[] }> = {
  ...DECISIVE_KEYWORDS,
  ...INGREDIENT_KEYWORDS,
  ...Object.assign({}, ...Object.values(CATEGORY_KEYWORDS)),
};

/** 카테고리에서 쓰는 키워드 사전 (공통 + 성분 + 그 카테고리 전용) */
export function keywordDictionaryFor(category: string | null) {
  return { ...DECISIVE_KEYWORDS, ...INGREDIENT_KEYWORDS, ...(category ? (CATEGORY_KEYWORDS[category] ?? {}) : {}) };
}

/** 인용 도메인의 종류 (타겟 매체 액션 문구에 쓴다) */
export const DOMAIN_TYPES: { match: string; label: string; action: string }[] = [
  { match: "cosme.net", label: "@cosme (리뷰·랭킹)", action: "@cosme 리뷰 수·랭킹 진입 확보" },
  { match: "the360.life", label: "LDK the Beauty (비교 검증 매체)", action: "LDK 비교 테스트에 샘플 제공" },
  { match: "prtimes.jp", label: "PR TIMES (보도자료)", action: "PR TIMES 보도자료 배포" },
  { match: "maquia.hpplus.jp", label: "MAQUIA (뷰티 매체)", action: "뷰티 매체 기사·광고 노출" },
  { match: "biteki.com", label: "美的.com (뷰티 매체)", action: "뷰티 매체 기사·광고 노출" },
  { match: "ameblo.jp", label: "Ameba 블로그", action: "블로거 시딩" },
  { match: "note.com", label: "note (블로그)", action: "블로거 시딩" },
  { match: "rakuten.co.jp", label: "楽天市場 (상품 페이지)", action: "楽天 상세페이지 문구 보강" },
  { match: "qoo10.jp", label: "Qoo10 (상품 페이지)", action: "Qoo10 상세페이지 문구 보강" },
];

export function domainType(domain: string) {
  return DOMAIN_TYPES.find((d) => domain === d.match || domain.endsWith(`.${d.match}`)) ?? { match: domain, label: domain, action: "매체 노출 검토" };
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** 원문에서 표기를 찾는다 (전각·반각·대소문자·공백 차이 무시). 찾으면 원문 위치 */
function findIn(text: string, alias: string): number {
  return fold(text).indexOf(fold(alias));
}

/** 브랜드 사전: 통일 이름 → 표기. 자사 + 등록된 경쟁 브랜드 + 알려진 실제 브랜드 */
export function brandDictionary(ownBrand: string, competitorBrands: string[]): Record<string, string[]> {
  return {
    ...KNOWN_BRANDS,
    ...Object.fromEntries(competitorBrands.filter((b) => b !== ownBrand && !(b in KNOWN_BRANDS)).map((b) => [b, [b]])),
    // 자사(Leaf&)면 자사 표기 흔들림, 알려진 실제 브랜드면 그 표기 (예: Torriden 본사가 돌릴 때 トリデン·토리든)
    [ownBrand]: [...new Set([ownBrand, ...(ownBrand === OWN_BRAND ? OWN_BRAND_ALIASES : []), ...(KNOWN_BRANDS[ownBrand] ?? [])])],
  };
}

/** LLM이 뽑은 브랜드 이름을 사전의 통일 이름으로 (없으면 그대로) */
export function canonicalBrand(name: string, dictionary: Record<string, string[]>): string {
  const f = fold(name);
  return Object.entries(dictionary).find(([, aliases]) => aliases.some((a) => fold(a) === f || f.includes(fold(a))))?.[0] ?? name.trim();
}

/** LLM이 뽑은 키워드를 사전의 통일 이름으로 (없으면 원문 표기 그대로) */
export function canonicalKeyword(text: string, category: string | null): string {
  const f = fold(text);
  return Object.entries(keywordDictionaryFor(category)).find(([, { aliases }]) => aliases.some((a) => f.includes(fold(a))))?.[0] ?? text.trim();
}

/** 답변에 나온 사전 브랜드 (순위는 rankMentions에서) */
export function detectBrands(answer: string, dictionary: Record<string, string[]>) {
  return Object.entries(dictionary).flatMap(([brand, aliases]) => {
    const hits = aliases.map((a) => ({ a, at: findIn(answer, a) })).filter((h) => h.at >= 0);
    if (hits.length === 0) return [];
    return [{ brand, matched_text: hits.toSorted((x, y) => x.at - y.at)[0].a, source: "dictionary" as TermSource }];
  });
}

/** 원문에서 처음 나온 위치 순으로 순위를 매긴다 (rank 1 = 가장 먼저 언급). 원문에 없는 항목은 버린다 */
export function rankMentions(answer: string, mentions: { brand: string; matched_text: string; source: TermSource }[]) {
  return mentions
    .map((m) => ({ ...m, at: findIn(answer, m.matched_text) }))
    .filter((m) => m.at >= 0)
    .toSorted((x, y) => x.at - y.at)
    .map(({ brand, matched_text, source }, i) => ({ brand, rank: i + 1, matched_text, source }));
}

export function detectKeywords(answer: string, category: string | null = null) {
  return Object.entries(keywordDictionaryFor(category)).flatMap(([keyword, { aliases }]) => {
    const hit = aliases.find((a) => findIn(answer, a) >= 0);
    return hit ? [{ keyword, matched_text: hit, source: "dictionary" as TermSource }] : [];
  });
}

/** LLM이 뽑은 말이 원문에 그대로 있는지 (없으면 버린다) */
export function verifyInAnswer(answer: string, text: string): boolean {
  return text.trim().length > 0 && findIn(answer, text) >= 0;
}

/** 일본어 답변을 문장으로 나눈다 (키워드가 어느 브랜드 추천 문장에 붙었는지 보려고) */
export function splitSentences(answer: string): string[] {
  return answer.split(/(?<=[。！？!?])|\n/).map((s) => s.trim()).filter(Boolean);
}

/** 문장 안에 표기가 있는지 */
export function sentenceHas(sentence: string, aliases: string[]): boolean {
  return aliases.some((a) => findIn(sentence, a) >= 0);
}

/**
 * 문장 안에서 키워드가 어느 브랜드의 추천 사유인지: 키워드 바로 앞에 나온 브랜드 (앞에 없으면 바로 뒤).
 * 「SampleA はアルコールフリー、Leaf& は低刺激」에서 アルコールフリー는 SampleA, 低刺激는 Leaf&
 */
export function attributeKeyword(sentence: string, keywordAliases: string[], brands: { brand: string; matched_text: string }[]): string | null {
  const k = Math.min(...keywordAliases.map((a) => findIn(sentence, a)).filter((i) => i >= 0));
  if (!Number.isFinite(k)) return null;
  const located = brands.map((b) => ({ brand: b.brand, at: findIn(sentence, b.matched_text) })).filter((b) => b.at >= 0);
  const before = located.filter((b) => b.at <= k).toSorted((x, y) => y.at - x.at)[0];
  const after = located.filter((b) => b.at > k).toSorted((x, y) => x.at - y.at)[0];
  return (before ?? after)?.brand ?? null;
}

export function isIngredientKeyword(keyword: string): boolean {
  return keyword in INGREDIENT_KEYWORDS;
}
