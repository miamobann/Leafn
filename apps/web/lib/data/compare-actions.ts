"use server";

// 경쟁제품 1:1 비교의 일본어 문구 해석 (Server Action). 비교 패널을 열 때 화면에 보이는 일본어만 한 번에 번역한다 (저장하지 않음).
// 유료 AI 호출이라 Supabase가 연결된 환경에서는 로그인한 사람만 부를 수 있다
import { z } from "zod";
import { AiConfigError } from "@/lib/ai/config";
import { translateProductTexts } from "@/lib/ai/translate/product-text";
import { getCurrentUser, isSupabaseConfigured } from "./workspace";

const Input = z.array(z.string().trim().min(1).max(400)).min(1).max(40);

export type CompareTranslateResult = { ok: true; items: Record<string, string> } | { ok: false; message: string };

export async function translateCompareTexts(texts: string[]): Promise<CompareTranslateResult> {
  const parsed = Input.safeParse(texts);
  if (!parsed.success) return { ok: false, message: "번역할 문구 형식이 올바르지 않아요" };
  if (isSupabaseConfigured() && !(await getCurrentUser())) return { ok: false, message: "로그인이 필요해요" };
  try {
    return { ok: true, items: Object.fromEntries(await translateProductTexts(parsed.data)) };
  } catch (e) {
    if (e instanceof AiConfigError) return { ok: false, message: "AI 키가 없어 한국어 해석을 만들지 못했어요" };
    return { ok: false, message: e instanceof Error ? `한국어 해석을 만들지 못했어요: ${e.message}` : "한국어 해석을 만들지 못했어요" };
  }
}
