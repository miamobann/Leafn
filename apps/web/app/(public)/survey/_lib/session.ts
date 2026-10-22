import { SurveySession } from "@/lib/schemas/survey";

// 문항 화면에서 결과 화면으로 답을 넘기는 브라우저 세션 저장소. 탭을 닫으면 사라진다
const SESSION_KEY = "leafn-survey";
const listeners = new Set<() => void>();

export function saveSession(session: SurveySession) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // 사생활 보호 모드 등에서 막히면 결과 화면이 "답이 없음"을 보여 준다
  }
  listeners.forEach((l) => l());
}

export function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // 위와 같음
  }
  listeners.forEach((l) => l());
}

/** useSyncExternalStore용: 문자열을 그대로 돌려줘야 렌더마다 같은 값으로 비교된다 */
export function readSessionRaw(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function subscribeSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function parseSession(raw: string | null): SurveySession | null {
  if (!raw) return null;
  try {
    const result = SurveySession.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
