// POST /api/trends/appeal — 랭킹 상위 상품 이미지를 분석해 소구 성분·프로모션을 뽑는다 (출처별로 따로)
// 입력: { source: "rakuten_ranking" | "qoo10_ranking", category: "化粧水" }
// 저장: trend_snapshots (마이그레이션 적용 전이면 저장하지 않고 결과만 돌려준다)
import OpenAI from "openai";
import { NextResponse } from "next/server";
import { extractAppeal } from "@/lib/ai/extract-appeal";
import { AiConfigError } from "@/lib/ai/openai";
import { getRankingSources } from "@/lib/data";
import { getCurrentUser, getMyWorkspace, isSupabaseConfigured } from "@/lib/data/workspace";
import { AppealRunInput, type RankingItem } from "@/lib/schemas/trend";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const TOP_N = 10;
const CONCURRENCY = 3;

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    }),
  );
  return results;
}

function errorMessage(e: unknown): string {
  if (e instanceof OpenAI.RateLimitError) return "OpenAI 호출 한도에 걸렸어요. 잠시 뒤 다시 시도해 주세요.";
  if (e instanceof OpenAI.AuthenticationError) return "OPENAI_API_KEY가 올바르지 않아요.";
  if (e instanceof OpenAI.APIError) return `OpenAI 오류 (${e.status}): ${e.message}`;
  return e instanceof Error ? e.message : "알 수 없는 오류";
}

export async function POST(request: Request) {
  if (isSupabaseConfigured() && !(await getCurrentUser())) {
    return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });
  }
  const input = AppealRunInput.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "입력 형식이 올바르지 않아요", detail: input.error.issues }, { status: 400 });

  const sources = (await getRankingSources(input.data)).filter((s) => s.rank <= TOP_N);
  if (sources.length === 0) return NextResponse.json({ error: "분석할 랭킹 상품이 없어요" }, { status: 404 });

  const failures: { rank: number; name: string; error: string }[] = [];
  let ranking: RankingItem[];
  try {
    ranking = await mapLimit(sources, CONCURRENCY, async (s) => {
      const base = { rank: s.rank, name: s.name, brand: s.brand, price_jpy: s.price_jpy, review_count: s.review_count, is_kbeauty: s.is_kbeauty };
      try {
        return { ...base, appeal: await extractAppeal(s) };
      } catch (e) {
        if (e instanceof AiConfigError || e instanceof OpenAI.AuthenticationError) throw e; // 설정 문제는 전체를 멈춘다
        failures.push({ rank: s.rank, name: `${s.brand} ${s.name}`, error: errorMessage(e) });
        return base; // 한 상품이 실패해도 나머지는 계속
      }
    });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 503 });
  }

  const snapshot = {
    source: input.data.source,
    category: input.data.category,
    captured_at: sources[0].captured_at,
    data: { ranking, ingredients: [] },
  };

  // 저장: 마이그레이션(trend_snapshots) 적용 전이거나 Supabase 미연결이면 건너뛴다
  let saved = false;
  let saveError: string | null = null;
  const membership = isSupabaseConfigured() ? await getMyWorkspace().catch(() => null) : null;
  if (membership) {
    const supabase = await createClient();
    const { error } = await supabase
      .from("trend_snapshots")
      .upsert({ ...snapshot, workspace_id: membership.workspace.id }, { onConflict: "workspace_id,source,category,captured_at" });
    saved = !error;
    saveError = error?.message ?? null;
  } else {
    saveError = "워크스페이스가 없어 저장하지 않았어요";
  }

  return NextResponse.json({ snapshot, failures, saved, saveError });
}
