// 시장 분석 원페이지(/market)의 카테고리·플랫폼 설정. 화면과 가짜 데이터 검사가 같이 쓰도록 한곳에 모은다.
// 카테고리별 포지셔닝 축·후보 영역·태그 사전은 해당 파트를 만들 때 이 파일에 추가한다.
import type { TrendSource } from "@/lib/schemas/trend";

export const MARKET_CATEGORIES = ["化粧水", "美容液", "クリーム"] as const;
export type MarketCategory = (typeof MARKET_CATEGORIES)[number];
export const CATEGORY_KO: Record<string, string> = { "化粧水": "화장수", "美容液": "미용액", "クリーム": "크림", "日焼け止め": "선크림", "クレンジング": "클렌징" };

/** 두 플랫폼의 랭킹은 합치지 않는다 (고객층·랭킹 산정 방식이 달라 상위권 조건이 왜곡된다) */
// eventPlatform = promo_events.platform 표기 (랭킹 주가 플랫폼 행사와 겹치는지 볼 때 쓴다)
export const MARKET_PLATFORMS = [
  { source: "qoo10_ranking", label: "Qoo10", eventPlatform: "Qoo10" },
  { source: "rakuten_ranking", label: "楽天", eventPlatform: "楽天市場" },
] as const satisfies readonly { source: TrendSource; label: string; eventPlatform: string }[];
export type MarketPlatform = (typeof MARKET_PLATFORMS)[number]["source"];

/**
 * 소구 태그 사전: 통일 이름 → { 한국어, 상품명·설명에서 찾을 표기 }.
 * 상위권 공통 특징의 "소구 태그 비중"은 이 목록에 있는 태그만 센다 (사전에 없는 말은 버린다)
 */
export const APPEAL_TAGS: Record<string, { ko: string; aliases: string[] }> = {
  "保湿": { ko: "보습", aliases: ["保湿", "うるおい"] },
  "低刺激": { ko: "저자극", aliases: ["低刺激", "敏感肌"] },
  "毛穴": { ko: "모공", aliases: ["毛穴"] },
  "透明感": { ko: "투명감", aliases: ["透明感", "くすみ"] },
  "ハリ": { ko: "탄력", aliases: ["ハリ"] },
  "ゆらぎ肌": { ko: "컨디션 난조 피부", aliases: ["ゆらぎ", "肌荒れ"] },
  "大容量": { ko: "대용량", aliases: ["大容量"] },
  "無香料": { ko: "무향료", aliases: ["無香料"] },
  "アルコールフリー": { ko: "무알코올", aliases: ["アルコールフリー", "ノンアルコール"] },
  "弱酸性": { ko: "약산성", aliases: ["弱酸性"] },
};

// ── PART 3 기회와 전략 ──────────────────────────────

/** 수요-공급 빈칸: Top 10 중 이 수 이하로만 쓰인 키워드를 "채택이 낮다"고 본다 (참고 기준, 팀 확인 전) */
export const GAP_MAX_ADOPTION = 3;
