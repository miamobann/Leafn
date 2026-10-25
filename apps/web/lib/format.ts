import { PROTOTYPE_TODAY } from "@/lib/mock/helpers";

export function formatJpy(value: number | null): string {
  return value == null ? "—" : `¥${value.toLocaleString("ja-JP")}`;
}

/** "2026-10-20T15:00:00+09:00" → "2026-10-20" (렌더링 중 Date를 쓰지 않는다) */
export function formatDate(value: string): string {
  return value.slice(0, 10);
}

/** 프로토타입의 고정된 "오늘" 기준 D-day. 날짜 문자열만으로 계산한다. */
export function dDay(date: string, today = PROTOTYPE_TODAY): string {
  const toDays = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86_400_000;
  const diff = toDays(date) - toDays(today);
  if (diff === 0) return "D-day";
  return diff > 0 ? `D-${diff}` : `D+${-diff}`;
}
