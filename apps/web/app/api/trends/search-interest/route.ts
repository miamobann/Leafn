// POST /api/trends/search-interest — 카테고리의 「카테고리 + 성분」 검색어를 Google Trends(일본, 최근 3개월)로 비교해 순위를 저장한다
// 입력: { category: "化粧水" | "美容液" | "クリーム" | "日焼け止め" } · SerpApi 호출 3번 (5개씩, 기준어로 한 저울에 맞춤)
// 저장: search_snapshots (engine = google_trends). 마이그레이션 적용 전이면 저장하지 않고 결과만 돌려준다
import { NextResponse } from "next/server";
import { getCurrentUser, getMyWorkspace, isSupabaseConfigured } from "@/lib/data/workspace";
import { collectOnOneScale, TRENDS_CATEGORIES, TRENDS_INGREDIENT_TERMS, TRENDS_REGION } from "@/lib/external/search-terms";
import { fetchTrendsAverages, SerpApiConfigError, TRENDS_MAX_QUERIES } from "@/lib/external/serpapi";
import { SearchInterestInput, type SearchSnap } from "@/lib/schemas/search";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (isSupabaseConfigured() && !(await getCurrentUser())) {
    return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });
  }
  const input = SearchInterestInput.safeParse(await request.json().catch(() => null));
  const category = TRENDS_CATEGORIES.find((c) => c === input.data?.category);
  if (!input.success || !category) return NextResponse.json({ error: "지원하지 않는 카테고리예요" }, { status: 400 });

  let ranked: { query: string; interest: number }[];
  try {
    ranked = await collectOnOneScale(
      TRENDS_INGREDIENT_TERMS.map((t) => `${category} ${t}`),
      (batch) => fetchTrendsAverages(batch, TRENDS_REGION),
      TRENDS_MAX_QUERIES,
    );
  } catch (e) {
    const status = e instanceof SerpApiConfigError ? 503 : 502;
    return NextResponse.json({ error: e instanceof Error ? e.message : "알 수 없는 오류" }, { status });
  }

  const snapshot: SearchSnap = {
    engine: "google_trends",
    seed: category,
    gl: TRENDS_REGION.geo.toLowerCase(),
    hl: TRENDS_REGION.hl,
    captured_at: new Date().toISOString(),
    suggestions: ranked.map((r, i) => ({ value: r.query, position: i + 1, relevance: r.interest })),
  };

  let saved = false;
  let saveError: string | null = null;
  const membership = isSupabaseConfigured() ? await getMyWorkspace().catch(() => null) : null;
  if (membership) {
    const supabase = await createClient();
    const { error } = await supabase.from("search_snapshots").insert({ ...snapshot, workspace_id: membership.workspace.id });
    saved = !error;
    saveError = error?.message ?? null;
  } else {
    saveError = "워크스페이스가 없어 저장하지 않았어요";
  }

  return NextResponse.json({ snapshots: [snapshot], failures: [], saved, saveError });
}
