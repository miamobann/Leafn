import { z } from "zod";

// 플랫폼 이름표(slug). DB의 platforms 기준표가 생기기 전까지 코드 상수가 그 역할을 한다 (DB_RULES 4.1).
// 한 번 쓴 slug는 바꾸지 않는다 (DB_RULES 1장 7번). 새 플랫폼은 여기에 한 줄 + 시드 마이그레이션을 같은 PR에서.
// 지금은 qoo10, rakuten만 쓴다. @cosme 계열은 쓰게 될 때 slug를 정해 추가한다.
export const PLATFORMS = [
  { id: "qoo10", label: "Qoo10" },
  { id: "rakuten", label: "楽天市場" },
] as const;

export const PlatformId = z.enum(PLATFORMS.map((p) => p.id) as [string, ...string[]]);
export type PlatformId = (typeof PLATFORMS)[number]["id"];

/** 화면에 보여 줄 플랫폼 이름 */
export function platformLabel(id: string): string {
  return PLATFORMS.find((p) => p.id === id)?.label ?? id;
}
