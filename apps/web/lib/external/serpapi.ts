// SerpApi Google 자동완성 (서버 전용. SERPAPI_API_KEY는 NEXT_PUBLIC_ 없이 서버에서만 읽는다)
// https://serpapi.com/google-autocomplete-api
import { z } from "zod";
import type { SearchSuggestion } from "@/lib/schemas/search";

export class SerpApiConfigError extends Error {}

const MAX_SUGGESTIONS = 10;

// 응답에서 쓰는 칸만 검증한다 (serpapi_link 등은 저장하지 않는다)
const AutocompleteResponse = z.object({
  suggestions: z.array(z.object({ value: z.string(), relevance: z.number().optional() })).optional(),
  error: z.string().optional(),
});

export async function fetchAutocomplete(q: string, region: { gl: string; hl: string }): Promise<SearchSuggestion[]> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) throw new SerpApiConfigError("SERPAPI_API_KEY가 설정되지 않았어요. apps/web/.env.local에 추가한 뒤 개발 서버를 다시 켜 주세요.");

  const url = new URL("https://serpapi.com/search.json");
  url.search = new URLSearchParams({ engine: "google_autocomplete", q, gl: region.gl, hl: region.hl, api_key: apiKey }).toString();
  const res = await fetch(url, { cache: "no-store" });
  const parsed = AutocompleteResponse.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new Error(`SerpApi 응답 형식이 달라요 (${res.status})`);
  if (!res.ok || parsed.data.error) {
    if (res.status === 401) throw new SerpApiConfigError("SERPAPI_API_KEY가 올바르지 않아요.");
    throw new Error(`SerpApi 오류 (${res.status}): ${parsed.data.error ?? "알 수 없음"}`);
  }
  return (parsed.data.suggestions ?? []).slice(0, MAX_SUGGESTIONS).map((s, i) => ({ value: s.value, position: i + 1, relevance: s.relevance ?? null }));
}
