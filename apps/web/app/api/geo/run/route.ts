// POST /api/geo/run — 한 엔진 × 한 카테고리의 GEO 질의를 실행하고 geo_snapshots에 저장한다
// 입력: { category, engine, precise? } · precise = 질의마다 3회 반복 (기본 GEO_REPEAT_COUNT, 1회)
// 저장: geo_snapshots (마이그레이션 적용 전이면 저장하지 않고 결과만 돌려준다)
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { NextResponse } from "next/server";
import { geoRepeatCount } from "@/lib/ai/geo/config";
import { runGeo } from "@/lib/ai/geo/run";
import { AiConfigError } from "@/lib/ai/config";
import { getProducts } from "@/lib/data";
import { getCurrentUser, getMyWorkspace, isSupabaseConfigured } from "@/lib/data/workspace";
import { GEO_CATEGORIES } from "@/lib/external/geo-terms";
import { GeoRunInput } from "@/lib/schemas/geo";
import { createClient } from "@/lib/supabase/server";
import { OWN_BRAND } from "@/app/(internal)/(dashboard)/market/_lib/market";

// 웹 검색이 붙은 질의는 오래 걸린다 (질의 3개 × 반복, 3개씩 동시에)
export const maxDuration = 300;

function errorMessage(e: unknown): string {
  if (e instanceof OpenAI.RateLimitError || e instanceof Anthropic.RateLimitError) return "호출 한도에 걸렸어요. 잠시 뒤 다시 시도해 주세요.";
  if (e instanceof OpenAI.AuthenticationError) return "OPENAI_API_KEY가 올바르지 않아요.";
  if (e instanceof Anthropic.AuthenticationError) return "ANTHROPIC_API_KEY가 올바르지 않아요.";
  if (e instanceof OpenAI.APIError || e instanceof Anthropic.APIError) return `API 오류 (${e.status}): ${e.message}`;
  return e instanceof Error ? e.message : "알 수 없는 오류";
}

export async function POST(request: Request) {
  if (isSupabaseConfigured() && !(await getCurrentUser())) {
    return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });
  }
  const input = GeoRunInput.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "입력 형식이 올바르지 않아요", detail: input.error.issues }, { status: 400 });
  if (!GEO_CATEGORIES.some((c) => c.category === input.data.category)) {
    return NextResponse.json({ error: `지원하지 않는 카테고리예요: ${input.data.category}` }, { status: 400 });
  }

  const repeatCount = geoRepeatCount(input.data.precise);
  const products = await getProducts();
  let result: Awaited<ReturnType<typeof runGeo>>;
  try {
    result = await runGeo({
      engine: input.data.engine,
      category: input.data.category,
      repeatCount,
      ownBrand: OWN_BRAND,
      competitorBrands: [...new Set(products.filter((p) => p.kind === "competitor").map((p) => p.brand))],
    });
  } catch (e) {
    const status = e instanceof AiConfigError || e instanceof OpenAI.AuthenticationError || e instanceof Anthropic.AuthenticationError ? 503 : 500;
    return NextResponse.json({ error: errorMessage(e) }, { status });
  }
  if (result.snapshots.length === 0) {
    return NextResponse.json({ error: `답변을 하나도 받지 못했어요: ${result.failures.map((f) => f.error).join(" / ")}` }, { status: 502 });
  }

  let saved = false;
  let saveError: string | null = null;
  const membership = isSupabaseConfigured() ? await getMyWorkspace().catch(() => null) : null;
  if (membership) {
    const supabase = await createClient();
    const { error } = await supabase
      .from("geo_snapshots")
      .upsert(result.snapshots.map((s) => ({ ...s, workspace_id: membership.workspace.id })), { onConflict: "workspace_id,engine,category,query,run_index,captured_at" });
    saved = !error;
    saveError = error?.message ?? null;
  } else {
    saveError = "워크스페이스가 없어 저장하지 않았어요";
  }

  return NextResponse.json({ ...result, repeatCount, saved, saveError });
}
