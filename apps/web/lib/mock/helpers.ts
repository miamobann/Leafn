import type { z } from "zod";

/** 렌더링 중 현재 시각을 읽지 않도록 프로토타입의 "오늘"을 고정한다 */
export const PROTOTYPE_TODAY = "2026-10-21";

export const WORKSPACE_ID = "ws-1";

/** 가짜 데이터는 불러올 때 Zod로 검증한다. 잘못된 데이터는 빌드에서 걸린다. */
export function parseAll<T extends z.ZodTypeAny>(schema: T, rows: unknown[], name: string): z.infer<T>[] {
  return rows.map((row, i) => {
    const result = schema.safeParse(row);
    if (!result.success) {
      throw new Error(`가짜 데이터 검증 실패: ${name}[${i}]\n${result.error.message}`);
    }
    return result.data;
  });
}

export function ts(date: string, time = "10:00"): string {
  return `${date}T${time}:00+09:00`;
}
