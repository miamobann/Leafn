"use server";

// 상세페이지용 리뷰 번역 (Server Action). 국내 리뷰를 일본어로 번역하고 약기법 검토를 함께 한다.
// 번역기를 따로 두지 않고 광고 검토 AI(judgeLines, 정밀 등급)가 낸 일본어 번역(translated_text)과 위험 판정을 그대로 쓴다.
// 리뷰마다 ad_checks 1건(source = manual · 용도 = 상세페이지, 승인은 광고 검토 화면에서 owner가)과 review_translations 1건을 저장한다.
// 로그인한 사용자의 세션으로 읽고 쓰므로 RLS가 워크스페이스를 가른다 (service role 키는 쓰지 않는다).
import { z } from "zod";
import { AiCallError } from "@/lib/ai/client";
import { AiConfigError } from "@/lib/ai/config";
import { AdCheckParseError, judgeLines } from "@/lib/ai/ad-check/judge";
import { toAdCheck } from "@/lib/ai/ad-check/to-ad-check";
import { createClient } from "@/lib/supabase/server";
import { getAdProducts } from "./ad-products";
import { getMyWorkspace, isSupabaseConfigured } from "./workspace";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string };
export type TranslateResult = { translated: number; mustFix: number };

/** 한 번에 판정하는 리뷰 수 (광고 검토 AI는 한 요청에 20줄까지, 시간을 줄이려고 10줄). 화면의 묶음 크기와 같은 값 */
const TRANSLATE_BATCH = 10;
/** 한 건에 AI로 보내는 글자 수 상한 */
const MAX_REVIEW_CHARS = 500;

const fail = (message: string): { ok: false; message: string } => ({ ok: false, message });

function messageOf(e: unknown): string {
  if (e instanceof AiConfigError) return `AI 설정이 필요해요: ${e.message}`;
  if (e instanceof AiCallError) return `AI 호출에 실패했어요 (${e.message})`;
  if (e instanceof AdCheckParseError) return e.message;
  return "번역 중 알 수 없는 오류가 났어요. 다시 시도해 주세요.";
}

/** 선택한 국내 리뷰(최대 10건)를 일본어로 번역하고 약기법 검토를 돌려 저장한다. 같은 리뷰를 다시 번역하면 번역과 검토를 새것으로 바꾼다 */
export async function translateReviews(productId: string, reviewIds: string[]): Promise<ActionResult<TranslateResult>> {
  const input = z.object({ productId: z.uuid(), reviewIds: z.array(z.uuid()).min(1).max(TRANSLATE_BATCH) }).safeParse({ productId, reviewIds: [...new Set(reviewIds)] });
  if (!input.success) return fail(`한 번에 1~${TRANSLATE_BATCH}건까지 번역할 수 있어요.`);
  if (!isSupabaseConfigured()) return fail("Supabase가 연결되어 있지 않아 번역할 수 없어요.");
  const mine = await getMyWorkspace();
  if (!mine) return fail("워크스페이스가 없어요. 먼저 로그인하고 워크스페이스를 만들어 주세요.");

  // 판정에는 전성분이 필요하다 (사실과 다른 성분을 추정해서 보내지 않는다)
  const product = (await getAdProducts()).find((p) => p.id === input.data.productId);
  if (!product) return fail("이 제품은 전성분이 등록되어 있지 않아 약기법 검토를 할 수 없어요. 제품 정보에 전성분을 먼저 등록해 주세요.");

  const supabase = await createClient();
  const found = await supabase.from("reviews").select("id, body, product_id, lang, excluded_reason").in("id", input.data.reviewIds);
  if (found.error) return fail(`리뷰를 불러오지 못했어요: ${found.error.message}`);
  const byId = new Map(found.data.map((r) => [r.id as string, r]));
  const reviews = input.data.reviewIds.map((id) => byId.get(id));
  if (reviews.some((r) => !r || r.product_id !== productId || r.lang !== "ko" || r.excluded_reason)) {
    return fail("선택한 리뷰 중 이 제품의 국내 리뷰가 아닌 것이 있어요. 목록을 새로 고친 뒤 다시 골라 주세요.");
  }
  const chosen = reviews.map((r) => ({ id: r!.id as string, text: String(r!.body).replace(/\s+/g, " ").trim().slice(0, MAX_REVIEW_CHARS) }));

  let judged;
  try {
    judged = await judgeLines({
      product: { name: product.name_ko, product_category: product.product_category, ingredients: product.ingredients.map((i) => `${i.ko} (${i.ja})`) },
      usage: "detail_page",
      lines: chosen.map((c) => c.text),
    });
  } catch (e) {
    return fail(messageOf(e));
  }

  let translated = 0;
  let mustFix = 0;
  for (const [i, review] of chosen.entries()) {
    const line = judged.lines[i];
    const textJa = line.translated_text?.trim();
    if (!textJa) continue; // 번역이 비어 있으면 저장하지 않는다 (화면은 "번역함" 표시가 없는 채로 남는다)

    const check = toAdCheck({
      id: crypto.randomUUID(),
      workspaceId: mine.workspace.id,
      createdAt: new Date().toISOString(),
      lines: [review.text],
      judged: [line],
      productId: input.data.productId,
      usage: "detail_page",
      model: judged.model,
      promptVersion: `ad-check.${judged.promptVersion}`,
    });

    const savedCheck = await supabase.from("ad_checks").insert({
      id: check.id,
      created_at: check.created_at,
      workspace_id: mine.workspace.id,
      source: "manual",
      product_id: input.data.productId,
      input_text: check.input_text,
      input_lang: check.input_lang,
      usage: "detail_page",
      product_category: product.product_category,
      overall_risk: check.overall_risk ?? null,
      overall_action: check.overall_action ?? null,
      final_text: check.input_text,
      review_status: "pending",
      is_expert_review_requested: false,
      model: check.model,
      prompt_version: check.prompt_version,
    });
    if (savedCheck.error) return fail(`약기법 검토를 저장하지 못했어요: ${savedCheck.error.message}. ${translated}건은 저장됐어요.`);

    const lineRows = (check.line_results ?? []).map((l) => ({
      workspace_id: mine.workspace.id,
      ad_check_id: check.id,
      line_index: l.line_index,
      block_key: null,
      original: l.original,
      action: l.action,
      findings: check.findings.filter((f) => f.line_index === l.line_index),
      ingredient_check: l.ingredient_check,
      translated_text: l.translated_text,
      back_translation_ko: l.back_translation_ko,
      localized_note: l.localized_note,
    }));
    const savedLines = await supabase.from("ad_check_lines").insert(lineRows);
    if (savedLines.error) return fail(`줄별 판정을 저장하지 못했어요: ${savedLines.error.message}. ${translated}건은 저장됐어요.`);

    const savedTranslation = await supabase
      .from("review_translations")
      .upsert({ workspace_id: mine.workspace.id, review_id: review.id, ad_check_id: check.id, text_ja: textJa, status: "draft" }, { onConflict: "review_id" });
    if (savedTranslation.error) return fail(`번역을 저장하지 못했어요: ${savedTranslation.error.message}. ${translated}건은 저장됐어요.`);

    translated += 1;
    if (line.action === "must_fix") mustFix += 1;
  }

  if (translated === 0) return fail("AI가 번역을 돌려주지 않았어요. 다시 시도해 주세요.");
  return { ok: true, data: { translated, mustFix } };
}

/** 번역한 리뷰를 목록에서 지운다. 약기법 검토 기록(ad_checks)은 증거라서 남긴다 */
export async function deleteTranslations(ids: string[]): Promise<ActionResult<{ deleted: number }>> {
  const parsed = z.array(z.uuid()).min(1).max(200).safeParse(ids);
  if (!parsed.success) return fail("지울 번역을 다시 골라 주세요.");
  if (!isSupabaseConfigured() || !(await getMyWorkspace())) return fail("로그인한 뒤에 지울 수 있어요.");
  const supabase = await createClient();
  const removed = await supabase.from("review_translations").delete().in("id", parsed.data).select("id");
  if (removed.error) return fail(`지우지 못했어요: ${removed.error.message}`);
  return { ok: true, data: { deleted: removed.data.length } };
}
