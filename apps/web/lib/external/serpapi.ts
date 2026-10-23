// SerpApi Google 자동완성·Google Trends (서버 전용. SERPAPI_API_KEY는 NEXT_PUBLIC_ 없이 서버에서만 읽는다)
// https://serpapi.com/google-autocomplete-api · https://serpapi.com/google-trends-api
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

// Google Trends: 한 번에 검색어 5개까지, 값은 그 요청 안에서 가장 많이 검색된 말 = 100 기준 (0~100)
export const TRENDS_MAX_QUERIES = 5;

const TrendsResponse = z.object({
  interest_over_time: z
    .object({
      timeline_data: z.array(z.object({ values: z.array(z.object({ query: z.string(), extracted_value: z.number() })) })),
    })
    .optional(),
  error: z.string().optional(),
});

/** 검색어마다 기간 평균 관심도. 데이터가 없는 검색어는 0 */
export async function fetchTrendsAverages(queries: string[], region: { geo: string; hl: string; date: string }): Promise<Record<string, number>> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) throw new SerpApiConfigError("SERPAPI_API_KEY가 설정되지 않았어요. apps/web/.env.local에 추가한 뒤 개발 서버를 다시 켜 주세요.");
  if (queries.length === 0 || queries.length > TRENDS_MAX_QUERIES) throw new Error(`Google Trends는 한 번에 1~${TRENDS_MAX_QUERIES}개만 비교해요`);

  const url = new URL("https://serpapi.com/search.json");
  url.search = new URLSearchParams({
    engine: "google_trends",
    data_type: "TIMESERIES",
    q: queries.join(","),
    geo: region.geo,
    hl: region.hl,
    date: region.date,
    api_key: apiKey,
  }).toString();
  const res = await fetch(url, { cache: "no-store" });
  const parsed = TrendsResponse.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new Error(`SerpApi(Google Trends) 응답 형식이 달라요 (${res.status})`);
  const zeros = Object.fromEntries(queries.map((q) => [q, 0]));
  if (parsed.data.error) {
    if (res.status === 401) throw new SerpApiConfigError("SERPAPI_API_KEY가 올바르지 않아요.");
    // 검색량이 너무 적으면 Google Trends가 결과를 주지 않는다 → 모두 0으로 본다
    if (/hasn't returned any results/i.test(parsed.data.error)) return zeros;
    throw new Error(`SerpApi(Google Trends) 오류 (${res.status}): ${parsed.data.error}`);
  }
  const timeline = parsed.data.interest_over_time?.timeline_data ?? [];
  if (timeline.length === 0) return zeros;
  const sums: Record<string, number> = { ...zeros };
  for (const point of timeline) for (const v of point.values) if (v.query in sums) sums[v.query] += v.extracted_value;
  return Object.fromEntries(Object.entries(sums).map(([q, sum]) => [q, sum / timeline.length]));
}
