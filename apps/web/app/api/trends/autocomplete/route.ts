// POST /api/trends/autocomplete — 시드 검색어마다 Google 자동완성(일본)을 받아 저장한다 (미래 트렌드)
// 저장: search_snapshots (마이그레이션 적용 전이면 저장하지 않고 결과만 돌려준다)
import { NextResponse } from "next/server";
import { AUTOCOMPLETE_REGION, AUTOCOMPLETE_SEEDS } from "@/lib/external/search-terms";
import { fetchAutocomplete, SerpApiConfigError } from "@/lib/external/serpapi";
import { getCurrentUser, getMyWorkspace, isSupabaseConfigured } from "@/lib/data/workspace";
import type { SearchSnap } from "@/lib/schemas/search";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function POST() {
  if (isSupabaseConfigured() && !(await getCurrentUser())) {
    return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });
  }

  const capturedAt = new Date().toISOString();
  const snapshots: SearchSnap[] = [];
  const failures: { seed: string; error: string }[] = [];
  // 시드 4개뿐이라 순서대로 부른다 (호출 한도 보호)
  for (const seed of AUTOCOMPLETE_SEEDS) {
    try {
      const suggestions = await fetchAutocomplete(seed, AUTOCOMPLETE_REGION);
      snapshots.push({ engine: "google_autocomplete", seed, ...AUTOCOMPLETE_REGION, captured_at: capturedAt, suggestions });
    } catch (e) {
      if (e instanceof SerpApiConfigError) return NextResponse.json({ error: e.message }, { status: 503 });
      failures.push({ seed, error: e instanceof Error ? e.message : "알 수 없는 오류" });
    }
  }
  if (snapshots.length === 0) return NextResponse.json({ error: `자동완성을 받지 못했어요: ${failures.map((f) => f.error).join(" / ")}` }, { status: 502 });

  let saved = false;
  let saveError: string | null = null;
  const membership = isSupabaseConfigured() ? await getMyWorkspace().catch(() => null) : null;
  if (membership) {
    const supabase = await createClient();
    const { error } = await supabase
      .from("search_snapshots")
      .upsert(snapshots.map((s) => ({ ...s, workspace_id: membership.workspace.id })), { onConflict: "workspace_id,engine,seed,gl,hl,captured_at" });
    saved = !error;
    saveError = error?.message ?? null;
  } else {
    saveError = "워크스페이스가 없어 저장하지 않았어요";
  }

  return NextResponse.json({ snapshots, failures, saved, saveError });
}
