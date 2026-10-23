"use server";

// 진출 실행 탭의 쓰기 함수 (Server Action).
// DB 연결 전이라 입력을 검증한 뒤 결과만 돌려준다. 화면은 로컬 상태로 반영하고 "저장되지 않음"을 표시한다.
// promo_events·platform_notes 테이블이 생기면 같은 시그니처로 Supabase update/insert를 부르게 바꾼다.
import { PlatformNotePatch } from "@/lib/schemas/platform";
import { PromoEventInput } from "@/lib/schemas/promo";
import type { PromoEventView } from "./launch";

export async function updatePlatformNote(id: string, patch: PlatformNotePatch) {
  return { id, ...PlatformNotePatch.parse(patch) };
}

export async function createPromoEvent(input: PromoEventInput): Promise<PromoEventView> {
  const e = PromoEventInput.parse(input);
  const id = `draft-${e.start_date}-${e.title}`;
  return {
    id,
    platformKey: e.platform,
    platformName: e.platform ?? "자사 캠페인",
    kind: e.kind,
    title: e.title,
    startDate: e.start_date,
    endDate: e.end_date,
    milestones: e.milestones.map((m, i) => ({ id: `${id}-m${i}`, label: m.label, dueDate: m.due_date, done: false })),
    adCheck: null,
  };
}

export async function setMilestoneDone(id: string, done: boolean) {
  return { id, done };
}
