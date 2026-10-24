// 시장 분석 원페이지(/market)의 카테고리·플랫폼 설정. 화면과 가짜 데이터 검사가 같이 쓰도록 한곳에 모은다.
// 카테고리별 포지셔닝 축·후보 영역·태그 사전은 해당 파트를 만들 때 이 파일에 추가한다.
import type { TrendSource } from "@/lib/schemas/trend";

export const MARKET_CATEGORIES = ["化粧水", "美容液", "クリーム"] as const;
export type MarketCategory = (typeof MARKET_CATEGORIES)[number];

/** 두 플랫폼의 랭킹은 합치지 않는다 (고객층·랭킹 산정 방식이 달라 상위권 조건이 왜곡된다) */
export const MARKET_PLATFORMS = [
  { source: "rakuten_ranking", label: "楽天" },
  { source: "qoo10_ranking", label: "Qoo10" },
] as const satisfies readonly { source: TrendSource; label: string }[];
export type MarketPlatform = (typeof MARKET_PLATFORMS)[number]["source"];
