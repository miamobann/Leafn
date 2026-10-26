"use server";

// 제품명 정리 (Server Action). 경쟁 제품의 긴 제목을 AI로 정리해 products.title_ai 에 저장한다.
// 로그인한 사용자의 세션으로 읽고 쓰므로 RLS가 워크스페이스를 가른다 (service role 키는 쓰지 않는다).
// 한 번 부를 때 최대 30개만 처리하고, 화면이 남은 수가 0이 될 때까지 반복해서 부른다.
import { z } from "zod";
import { AiCallError } from "@/lib/ai/client";
import { AiConfigError } from "@/lib/ai/config";
import { PRODUCT_TITLE_BATCH, ProductTitleParseError, summarizeProductTitles } from "@/lib/ai/product-title/summarize";
import { createClient } from "@/lib/supabase/server";
import { getMyWorkspace, isSupabaseConfigured } from "./workspace";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string };
export type TitleBatchResult = { processed: number; remaining: number };

const PAGE = 1000; // PostgREST가 한 번에 돌려주는 최대 행 수
type Supabase = Awaited<ReturnType<typeof createClient>>;

const fail = (message: string): { ok: false; message: string } => ({ ok: false, message });

function messageOf(e: unknown): string {
  if (e instanceof AiConfigError) return `AI 설정이 필요해요: ${e.message}`;
  if (e instanceof AiCallError) return `AI 호출에 실패했어요 (${e.message})`;
  if (e instanceof ProductTitleParseError) return e.message;
  return "제품명을 정리하다 알 수 없는 오류가 났어요. 다시 시도해 주세요.";
}

/** 제품명 정리 전(title_ai 가 null)인 경쟁 제품. 오래된 순 */
async function readUntitled(supabase: Supabase, productId: string | null): Promise<{ id: string; brand: string; name: string }[]> {
  const rows: { id: string; brand: string; name: string }[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from("products").select("id, brand, name").eq("kind", "competitor").is("title_ai", null);
    if (productId) query = query.eq("id", productId);
    const { data, error } = await query.order("created_at").order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(`제품을 불러오지 못했습니다: ${error.message}`);
    for (const row of data) rows.push({ id: row.id as string, brand: String(row.brand ?? ""), name: String(row.name) });
    if (data.length < PAGE) break;
  }
  return rows;
}

/** 제품명 정리 대기 수. 연결이 없거나 로그인 전이거나 칸이 아직 없으면(마이그레이션 전) 0 */
export async function getUntitledCount(productId?: string): Promise<number> {
  if (!isSupabaseConfigured() || !(await getMyWorkspace())) return 0;
  if (productId !== undefined && !z.uuid().safeParse(productId).success) return 0;
  try {
    return (await readUntitled(await createClient(), productId ?? null)).length;
  } catch {
    return 0; // title_ai 칸이 아직 없으면 조회가 실패한다. 버튼을 숨기고 원문 제품명을 그대로 보여 준다
  }
}

/** 다음 한 묶음(최대 30개)을 정리해 저장한다. productId 가 없으면 워크스페이스 전체에서 고른다 */
export async function summarizeNextBatch(productId?: string): Promise<ActionResult<TitleBatchResult>> {
  if (productId !== undefined && !z.uuid().safeParse(productId).success) return fail("제품 번호 형식이 올바르지 않아요.");
  if (!isSupabaseConfigured()) return fail("Supabase가 연결되어 있지 않아 제품명을 정리할 수 없어요.");
  if (!(await getMyWorkspace())) return fail("워크스페이스가 없어요. 먼저 로그인하고 워크스페이스를 만들어 주세요.");

  const supabase = await createClient();
  let todo: { id: string; brand: string; name: string }[];
  try {
    todo = await readUntitled(supabase, productId ?? null);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "제품을 불러오지 못했어요.");
  }
  if (todo.length === 0) return { ok: true, data: { processed: 0, remaining: 0 } };

  const batch = todo.slice(0, PRODUCT_TITLE_BATCH);
  let result;
  try {
    result = await summarizeProductTitles(batch.map((p) => ({ brand: p.brand, title: p.name })));
  } catch (e) {
    return fail(messageOf(e));
  }

  const saved = await Promise.all(batch.map((p, i) => supabase.from("products").update({ title_ai: result.titles[i] }).eq("id", p.id)));
  const failed = saved.find((s) => s.error);
  if (failed?.error) return fail(`정리한 제품명을 저장하지 못했어요: ${failed.error.message}`);

  return { ok: true, data: { processed: batch.length, remaining: todo.length - batch.length } };
}
