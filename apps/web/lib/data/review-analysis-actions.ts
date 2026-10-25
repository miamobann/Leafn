"use server";

// 리뷰 AI 분석 (Server Action). 로그인한 사용자의 세션으로 읽고 쓰므로 RLS가 워크스페이스를 가른다 (service role 키는 쓰지 않는다).
// 한 번 부를 때 리뷰 50건(한 제품 · 한 언어)만 분석하고, 화면이 남은 건수가 0이 될 때까지 반복해서 부른다 (CLAUDE.md 0장).
// 결과: 제품 이야기가 있는 리뷰는 review_analyses 에 저장, 제품 외 불만(배송 · 파손 등)은 reviews.excluded_reason 만 채운다.
import { z } from "zod";
import { AiCallError } from "@/lib/ai/client";
import { AiConfigError } from "@/lib/ai/config";
import { analyzeReviews, BATCH_SIZE } from "@/lib/ai/review-analysis/analyze";
import { ReviewAnalysisParseError } from "@/lib/ai/review-analysis/parse";
import { translateReviewsToKorean } from "@/lib/ai/review-analysis/translate";
import type { Lang } from "@/lib/schemas/common";
import type { ExcludedReason } from "@/lib/schemas/review";
import { createClient } from "@/lib/supabase/server";
import { getUntitledCount } from "./product-title-actions";
import { getMyWorkspace, isSupabaseConfigured } from "./workspace";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string };
/** pending = 분석 전 리뷰, untranslated = 한국어 번역이 없는 일본어 리뷰, untitled = 제품명 정리 전인 경쟁 제품 */
export type AnalysisStatus = { pending: number; analyzed: number; untranslated: number; untitled: number };
export type AnalysisBatchResult = { processed: number; excluded: number; remaining: number };
export type TranslateBatchResult = { processed: number; remaining: number };

const PAGE = 1000; // PostgREST가 한 번에 돌려주는 최대 행 수
type Supabase = Awaited<ReturnType<typeof createClient>>;
type PendingReview = { id: string; product_id: string; lang: Lang; body: string };

const fail = (message: string): { ok: false; message: string } => ({ ok: false, message });

function messageOf(e: unknown): string {
  if (e instanceof AiConfigError) return `AI 설정이 필요해요: ${e.message}`;
  if (e instanceof AiCallError) return `AI 호출에 실패했어요 (${e.message})`;
  if (e instanceof ReviewAnalysisParseError) return e.message;
  return "분석 중 알 수 없는 오류가 났어요. 다시 시도해 주세요.";
}

/** 분석 대상(제외되지 않은) 리뷰 중 아직 분석 결과가 없는 것. 오래된 순 */
async function readPending(supabase: Supabase, productId: string | null): Promise<{ total: number; pending: PendingReview[] }> {
  const analyzed = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from("review_analyses").select("review_id").order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(`분석 결과를 불러오지 못했습니다: ${error.message}`);
    for (const row of data) analyzed.add(row.review_id as string);
    if (data.length < PAGE) break;
  }

  const pending: PendingReview[] = [];
  let total = 0;
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from("reviews").select("id, product_id, lang, body").is("excluded_reason", null);
    if (productId) query = query.eq("product_id", productId);
    const { data, error } = await query.order("created_at").order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(`리뷰를 불러오지 못했습니다: ${error.message}`);
    for (const row of data) {
      total += 1;
      if (!analyzed.has(row.id as string)) pending.push({ id: row.id as string, product_id: row.product_id as string, lang: row.lang as Lang, body: row.body as string });
    }
    if (data.length < PAGE) break;
  }
  return { total, pending };
}

/** 한국어 번역이 아직 없는 일본어 리뷰 (제외되지 않은 것만). 오래된 순 */
async function readUntranslated(supabase: Supabase, productId: string | null): Promise<{ id: string; body: string }[]> {
  const rows: { id: string; body: string }[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from("reviews").select("id, body").eq("lang", "ja").is("excluded_reason", null).is("body_ko", null);
    if (productId) query = query.eq("product_id", productId);
    const { data, error } = await query.order("created_at").order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(`리뷰를 불러오지 못했습니다: ${error.message}`);
    for (const row of data) rows.push({ id: row.id as string, body: row.body as string });
    if (data.length < PAGE) break;
  }
  return rows;
}

/** 분석 · 번역 대기 건수. 연결이 없거나 로그인 전이면 0 (샘플 화면에서는 버튼이 나오지 않는다) */
export async function getAnalysisStatus(productId?: string): Promise<AnalysisStatus> {
  const none = { pending: 0, analyzed: 0, untranslated: 0, untitled: 0 };
  if (!isSupabaseConfigured() || !(await getMyWorkspace())) return none;
  if (productId !== undefined && !z.uuid().safeParse(productId).success) return none;
  const supabase = await createClient();
  const { total, pending } = await readPending(supabase, productId ?? null);
  const untranslated = await readUntranslated(supabase, productId ?? null);
  const untitled = await getUntitledCount(productId);
  return { pending: pending.length, analyzed: total - pending.length, untranslated: untranslated.length, untitled };
}

/** 다음 한 묶음(최대 50건)을 분석해 저장한다. productId 가 없으면 워크스페이스 전체에서 고른다 */
export async function analyzeNextBatch(productId?: string): Promise<ActionResult<AnalysisBatchResult>> {
  if (productId !== undefined && !z.uuid().safeParse(productId).success) return fail("제품 번호 형식이 올바르지 않아요.");
  if (!isSupabaseConfigured()) return fail("Supabase가 연결되어 있지 않아 분석할 수 없어요.");
  const mine = await getMyWorkspace();
  if (!mine) return fail("워크스페이스가 없어요. 먼저 로그인하고 워크스페이스를 만들어 주세요.");

  const supabase = await createClient();
  let pending: PendingReview[];
  try {
    pending = (await readPending(supabase, productId ?? null)).pending;
  } catch (e) {
    return fail(e instanceof Error ? e.message : "리뷰를 불러오지 못했어요.");
  }
  if (pending.length === 0) return { ok: true, data: { processed: 0, excluded: 0, remaining: 0 } };

  // 같은 제품 · 같은 언어끼리 묶는다 (프롬프트에 언어와 제품 종류를 알려 주기 때문)
  const first = pending[0];
  const batch = pending.filter((r) => r.product_id === first.product_id && r.lang === first.lang).slice(0, BATCH_SIZE);
  const product = await supabase.from("products").select("category").eq("id", first.product_id).maybeSingle();
  if (product.error) return fail(`제품을 확인하지 못했어요: ${product.error.message}`);

  let result;
  try {
    result = await analyzeReviews({ lang: first.lang, category: (product.data?.category as string | null) ?? null, reviews: batch });
  } catch (e) {
    return fail(messageOf(e));
  }

  const rows = result.items
    .filter((item) => !item.excluded_reason)
    .map((item) => ({
      workspace_id: mine.workspace.id,
      review_id: batch[item.index].id,
      sentiment: item.sentiment,
      keywords: item.keywords,
      pain_points: item.pain_points,
      repurchase_factors: item.repurchase_factors,
      topics: item.topics,
      model: result.model,
      prompt_version: result.promptVersion,
    }));
  if (rows.length > 0) {
    const saved = await supabase.from("review_analyses").upsert(rows, { onConflict: "review_id" });
    if (saved.error) return fail(`분석 결과를 저장하지 못했어요: ${saved.error.message}`);
  }

  const byReason = new Map<ExcludedReason, string[]>();
  for (const item of result.items) {
    if (!item.excluded_reason) continue;
    byReason.set(item.excluded_reason, [...(byReason.get(item.excluded_reason) ?? []), batch[item.index].id]);
  }
  let excluded = 0;
  for (const [reason, ids] of byReason) {
    const updated = await supabase.from("reviews").update({ excluded_reason: reason }).in("id", ids);
    if (updated.error) return fail(`제품 외 불만 표시를 저장하지 못했어요: ${updated.error.message}`);
    excluded += ids.length;
  }

  return { ok: true, data: { processed: batch.length, excluded, remaining: pending.length - batch.length } };
}

/** 다음 한 묶음(최대 50건)의 일본어 리뷰를 한국어로 번역해 reviews.body_ko 에 저장한다. 분석에서 제외된 리뷰는 번역하지 않는다 */
export async function translateNextBatch(productId?: string): Promise<ActionResult<TranslateBatchResult>> {
  if (productId !== undefined && !z.uuid().safeParse(productId).success) return fail("제품 번호 형식이 올바르지 않아요.");
  if (!isSupabaseConfigured()) return fail("Supabase가 연결되어 있지 않아 번역할 수 없어요.");
  if (!(await getMyWorkspace())) return fail("워크스페이스가 없어요. 먼저 로그인하고 워크스페이스를 만들어 주세요.");

  const supabase = await createClient();
  let todo: { id: string; body: string }[];
  try {
    todo = await readUntranslated(supabase, productId ?? null);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "리뷰를 불러오지 못했어요.");
  }
  if (todo.length === 0) return { ok: true, data: { processed: 0, remaining: 0 } };

  const batch = todo.slice(0, BATCH_SIZE);
  let result;
  try {
    result = await translateReviewsToKorean({ bodies: batch.map((r) => r.body) });
  } catch (e) {
    return fail(messageOf(e));
  }

  const saved = await Promise.all(batch.map((r, i) => supabase.from("reviews").update({ body_ko: result.texts[i] }).eq("id", r.id)));
  const failed = saved.find((s) => s.error);
  if (failed?.error) return fail(`번역을 저장하지 못했어요: ${failed.error.message}`);

  return { ok: true, data: { processed: batch.length, remaining: todo.length - batch.length } };
}
