// 게스트(포트폴리오 공개용 데모 계정) 판별.
// 데모 계정은 Supabase app_metadata.demo = true. DB 쪽 읽기 전용 트리거(migrations/20261106050000_guest_read_only.sql)와 같은 기준이다.
export const GUEST_READ_ONLY_MESSAGE = "게스트 모드는 읽기 전용이에요";

export function isGuestClaims(claims: unknown): boolean {
  if (!claims || typeof claims !== "object") return false;
  const meta = (claims as { app_metadata?: unknown }).app_metadata;
  return Boolean(meta && typeof meta === "object" && (meta as { demo?: unknown }).demo === true);
}
