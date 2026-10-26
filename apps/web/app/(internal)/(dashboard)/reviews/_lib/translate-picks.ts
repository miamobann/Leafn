"use client";

// 리포트 근거 패널의 [상세페이지용으로 담기]로 담은 리뷰 (제품마다). 화면을 옮기지 않고 담아 두었다가
// 상세페이지용 리뷰 화면(translate)이 열릴 때 "국내 리뷰 고르기"에 미리 체크한다.
// 브라우저 탭 안에서만 쓰는 임시 목록이라 sessionStorage에 둔다 (저장 실패해도 화면은 그대로 동작한다)
import { useCallback, useEffect, useState } from "react";

const key = (productId: string) => `leafn:translate-picks:${productId}`;
const EVENT = "leafn:translate-picks";

export function readTranslatePicks(productId: string): string[] {
  try {
    const raw = sessionStorage.getItem(key(productId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function writeTranslatePicks(productId: string, ids: string[]) {
  try {
    sessionStorage.setItem(key(productId), JSON.stringify(ids));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // 저장소를 쓸 수 없는 브라우저(사생활 보호 모드 등): 담기만 기억하지 못한다
  }
}

/** 담은 리뷰 id 목록과 담기/빼기. 같은 탭의 다른 화면 부품과 바로 맞춰진다 */
export function useTranslatePicks(productId: string) {
  const [picks, setPicks] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setPicks(readTranslatePicks(productId));
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, [productId]);
  const toggle = useCallback(
    (id: string) => {
      const now = readTranslatePicks(productId);
      writeTranslatePicks(productId, now.includes(id) ? now.filter((x) => x !== id) : [...now, id]);
    },
    [productId],
  );
  return { picks, toggle };
}
