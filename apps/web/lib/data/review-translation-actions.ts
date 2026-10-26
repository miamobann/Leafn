"use server";

// 상세페이지용 리뷰 번역 (Server Action). 국내 리뷰를 일본어로 번역하고 약기법 검토를 함께 한다.
// 번역기를 따로 두지 않고 광고 검토 AI(judgeLines, 정밀 등급)가 낸 일본어 번역(translated_text)과 위험 판정을 그대로 쓴다.
// 리뷰마다 ad_checks 1건(source = manual · 용도 = 상세페이지, 승인은 광고 검토 화면에서 owner가)과 review_translations 1건을 저장한다.
// 로그인한 사용자의 세션으로 읽고 쓰므로 RLS가 워크스페이스를 가른다 (service role 키는 쓰지 않는다).
import { z } from "zod";
import { AiCallError } from "@/lib/ai/client";
import { AiConfigError } from "@/lib/ai/config";
import { AdCheckParseError, judgeLines } from "@/lib/ai/ad-check/judge";
import { judgeReviews, logParseFailure } from "@/lib/ai/ad-check/judge-batch";
import { toAdCheck } from "@/lib/ai/ad-check/to-ad-check";
import { replaceSentence } from "@/lib/review-fix";
import { AdFinding } from "@/lib/schemas/ad-check";
import type { JudgedLine } from "@/lib/schemas/ad-check-ai";
import { createClient } from "@/lib/supabase/server";
import { getAdProducts } from "./ad-products";
import { getCurrentUser, getMyWorkspace, isSupabaseConfigured } from "./workspace";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string };
export type TranslateResult = { translated: number; mustFix: number; skipped: number };

/** 한 번에 판정하는 리뷰 수 (광고 검토 AI는 한 요청에 20줄까지, 긴 리뷰가 섞여도 형식이 깨지지 않게 5줄). 화면의 묶음 크기와 같은 값 */
const TRANSLATE_BATCH = 5;
/** 한 건에 AI로 보내는 글자 수 상한 */
const MAX_REVIEW_CHARS = 500;

const fail = (message: string): { ok: false; message: string } => ({ ok: false, message });

function messageOf(e: unknown): string {
  if (e instanceof AiConfigError) return `AI 설정이 필요해요: ${e.message}`;
  if (e instanceof AiCallError) return `AI 호출에 실패했어요 (${e.message})`;
  if (e instanceof AdCheckParseError) return e.message;
  return "번역 중 알 수 없는 오류가 났어요. 다시 시도해 주세요.";
}

type Db = Awaited<ReturnType<typeof createClient>>;
type Mine = NonNullable<Awaited<ReturnType<typeof getMyWorkspace>>>;
type AdProduct = NonNullable<Awaited<ReturnType<typeof getAdProducts>>[number]>;

/** 리뷰 한 건의 판정(ad_checks 1건 + ad_check_lines)을 저장한다. 승인은 광고 검토의 규칙대로 pending으로 시작 */
async function saveCheck(
  supabase: Db,
  mine: Mine,
  p: { productId: string; product: AdProduct; text: string; line: JudgedLine; model: string; promptVersion: string },
): Promise<{ ok: true; checkId: string } | { ok: false; message: string }> {
  const check = toAdCheck({
    id: crypto.randomUUID(),
    workspaceId: mine.workspace.id,
    createdAt: new Date().toISOString(),
    lines: [p.text],
    judged: [p.line],
    productId: p.productId,
    usage: "detail_page",
    model: p.model,
    promptVersion: `ad-check.${p.promptVersion}`,
  });

  const savedCheck = await supabase.from("ad_checks").insert({
    id: check.id,
    created_at: check.created_at,
    workspace_id: mine.workspace.id,
    source: "manual",
    product_id: p.productId,
    input_text: check.input_text,
    input_lang: check.input_lang,
    usage: "detail_page",
    product_category: p.product.product_category,
    overall_risk: check.overall_risk ?? null,
    overall_action: check.overall_action ?? null,
    final_text: check.input_text,
    review_status: "pending",
    is_expert_review_requested: false,
    model: check.model,
    prompt_version: check.prompt_version,
  });
  if (savedCheck.error) return { ok: false, message: `약기법 검토를 저장하지 못했어요: ${savedCheck.error.message}` };

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
  if (savedLines.error) return { ok: false, message: `줄별 판정을 저장하지 못했어요: ${savedLines.error.message}` };
  return { ok: true, checkId: check.id };
}

/** 선택한 국내 리뷰(최대 5건)를 일본어로 번역하고 약기법 검토를 돌려 저장한다. 같은 리뷰를 다시 번역하면 번역과 검토를 새것으로 바꾼다 */
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
    judged = await judgeReviews(
      {
        product: { name: product.name_ko, product_category: product.product_category, ingredients: product.ingredients.map((i) => `${i.ko} (${i.ja})`) },
        usage: "detail_page",
        lines: chosen.map((c) => c.text),
      },
      chosen.map((c) => c.id),
    );
  } catch (e) {
    return fail(messageOf(e));
  }

  let translated = 0;
  let mustFix = 0;
  let skipped = 0;
  for (const [i, review] of chosen.entries()) {
    const line = judged.lines[i];
    const textJa = line?.translated_text?.trim();
    if (!line || !textJa) {
      skipped += 1; // 판정이 없거나 번역이 비어 있으면 저장하지 않는다 (화면은 "번역함" 표시가 없는 채로 남는다)
      continue;
    }

    const saved = await saveCheck(supabase, mine, { productId: input.data.productId, product, text: review.text, line, model: judged.model, promptVersion: judged.promptVersion });
    if (!saved.ok) return fail(`${saved.message}. ${translated}건은 저장됐어요.`);

    const savedTranslation = await supabase
      .from("review_translations")
      .upsert({ workspace_id: mine.workspace.id, review_id: review.id, ad_check_id: saved.checkId, text_ja: textJa, status: "draft" }, { onConflict: "review_id" });
    if (savedTranslation.error) return fail(`번역을 저장하지 못했어요: ${savedTranslation.error.message}. ${translated}건은 저장됐어요.`);

    translated += 1;
    if (line.action === "must_fix") mustFix += 1;
  }

  if (translated === 0) return fail("AI가 번역을 돌려주지 않았어요. 다시 시도해 주세요.");
  return { ok: true, data: { translated, mustFix, skipped } };
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

/** 번역 한 건과 그 판정(ad_checks · 줄별 findings)을 읽는다. 로그인한 사람의 워크스페이스 것만 보인다 (RLS) */
async function loadTranslation(supabase: Db, translationId: string) {
  const t = await supabase.from("review_translations").select("id, review_id, ad_check_id, text_ja, status").eq("id", translationId).maybeSingle();
  if (t.error || !t.data || !t.data.ad_check_id) return null;
  const [check, lines] = await Promise.all([
    supabase.from("ad_checks").select("id, input_text, review_status, product_id").eq("id", t.data.ad_check_id).maybeSingle(),
    supabase.from("ad_check_lines").select("findings").eq("ad_check_id", t.data.ad_check_id),
  ]);
  if (check.error || !check.data || lines.error) return null;
  const findings = z.array(AdFinding).safeParse((lines.data ?? []).flatMap((l) => (Array.isArray(l.findings) ? l.findings : [])));
  return { translation: t.data, check: check.data, findings: findings.success ? findings.data : null };
}

/**
 * 약기법 검토가 짚은 표현의 대체 표현을 적용한다. 번역 전 한국어 문장 중 그 표현이 든 문장을 대체 표현으로 바꾸고,
 * 바뀐 문장을 다시 번역 + 약기법 검토해서 새 판정으로 이어 붙인다. 이전 판정은 증거로 남는다 (광고 검토 이력).
 * 대체 표현은 화면이 넘긴 글이 아니라 저장된 검토 기록에서 찾아 쓴다 (문구를 마음대로 끼워 넣지 못하게).
 */
export async function applySuggestion(translationId: string, findingText: string, suggestionText: string): Promise<ActionResult<{ mustFix: boolean }>> {
  const input = z.object({ translationId: z.uuid(), findingText: z.string().min(1).max(300), suggestionText: z.string().min(1).max(500) }).safeParse({ translationId, findingText, suggestionText });
  if (!input.success) return fail("고칠 표현을 다시 골라 주세요.");
  if (!isSupabaseConfigured()) return fail("Supabase가 연결되어 있지 않아 고칠 수 없어요.");
  const mine = await getMyWorkspace();
  if (!mine) return fail("워크스페이스가 없어요. 먼저 로그인하고 워크스페이스를 만들어 주세요.");

  const supabase = await createClient();
  const loaded = await loadTranslation(supabase, input.data.translationId);
  if (!loaded) return fail("번역을 찾지 못했어요. 목록을 새로 고친 뒤 다시 해 주세요.");
  if (loaded.translation.status === "approved" || loaded.check.review_status === "approved") return fail("승인된 번역은 고칠 수 없어요. 팀장이 승인을 취소한 뒤 고쳐 주세요.");

  const finding = loaded.findings?.find((f) => f.text === input.data.findingText);
  const suggestion = finding?.suggestion_rechecks?.find((r) => r.text === input.data.suggestionText && r.text_ko);
  if (!finding || !suggestion?.text_ko) return fail("이 대체 표현은 검토 기록에서 찾지 못했어요. 목록을 새로 고친 뒤 다시 해 주세요.");
  const fixed = replaceSentence(loaded.check.input_text, finding, suggestion.text_ko);
  if (!fixed) return fail("고칠 문장을 본문에서 찾지 못했어요. 광고 검토 화면에서 직접 고쳐 주세요.");

  const review = await supabase.from("reviews").select("product_id").eq("id", loaded.translation.review_id).maybeSingle();
  const productId = review.data?.product_id;
  const product = productId ? (await getAdProducts()).find((p) => p.id === productId) : undefined;
  if (!product) return fail("이 제품은 전성분이 등록되어 있지 않아 약기법 검토를 할 수 없어요.");

  let judged;
  try {
    judged = await judgeLines({
      product: { name: product.name_ko, product_category: product.product_category, ingredients: product.ingredients.map((i) => `${i.ko} (${i.ja})`) },
      usage: "detail_page",
      lines: [fixed],
    });
  } catch (e) {
    if (e instanceof AdCheckParseError) logParseFailure("applySuggestion", [translationId], e);
    return fail(messageOf(e));
  }
  const line = judged.lines[0];
  const textJa = line.translated_text?.trim();
  if (!textJa) return fail("AI가 번역을 돌려주지 않았어요. 다시 시도해 주세요.");

  const saved = await saveCheck(supabase, mine, { productId: product.id, product, text: fixed, line, model: judged.model, promptVersion: judged.promptVersion });
  if (!saved.ok) return fail(saved.message);
  const updated = await supabase.from("review_translations").update({ ad_check_id: saved.checkId, text_ja: textJa, status: "draft" }).eq("id", input.data.translationId);
  if (updated.error) return fail(`번역을 저장하지 못했어요: ${updated.error.message}`);
  return { ok: true, data: { mustFix: line.action === "must_fix" } };
}

/** 번역을 승인한다 (팀장 = 워크스페이스 owner만). 고쳐야 할 표현이 남아 있으면 승인할 수 없다. 승인하면 광고 검토 이력에서도 「내부 검토 완료」가 된다 */
export async function approveTranslation(translationId: string): Promise<ActionResult<{ approved: true }>> {
  if (!z.uuid().safeParse(translationId).success) return fail("승인할 번역을 다시 골라 주세요.");
  if (!isSupabaseConfigured()) return fail("Supabase가 연결되어 있지 않아 승인할 수 없어요.");
  const [user, mine] = await Promise.all([getCurrentUser(), getMyWorkspace()]);
  if (!user || !mine) return fail("로그인이 필요해요.");
  if (mine.role !== "owner") return fail("승인은 팀장(워크스페이스 관리자)만 할 수 있어요.");

  const supabase = await createClient();
  const loaded = await loadTranslation(supabase, translationId);
  if (!loaded) return fail("번역을 찾지 못했어요. 목록을 새로 고친 뒤 다시 해 주세요.");
  if (!loaded.findings) return fail("약기법 검토 기록을 읽지 못했어요. 광고 검토 화면에서 확인해 주세요.");
  if (loaded.findings.some((f) => f.risk === "high" || f.action === "must_fix")) return fail("고쳐야 할 표현이 남아 있어요. 대체 표현을 적용해 다시 검토한 뒤 승인해 주세요.");

  const checked = await supabase
    .from("ad_checks")
    .update({ review_status: "approved", reviewer_id: user.id, reviewed_at: new Date().toISOString(), final_text: loaded.translation.text_ja })
    .eq("id", loaded.check.id)
    .eq("workspace_id", mine.workspace.id)
    .select("id")
    .maybeSingle();
  if (checked.error || !checked.data) return fail("승인을 저장하지 못했어요.");
  const updated = await supabase.from("review_translations").update({ status: "approved" }).eq("id", translationId);
  if (updated.error) return fail(`승인을 저장하지 못했어요: ${updated.error.message}`);
  return { ok: true, data: { approved: true } };
}

/** 승인을 취소해 다시 검토 대기로 돌린다 (팀장만). 승인된 번역을 고치려면 먼저 취소한다 */
export async function revokeApproval(translationId: string): Promise<ActionResult<{ revoked: true }>> {
  if (!z.uuid().safeParse(translationId).success) return fail("번역을 다시 골라 주세요.");
  if (!isSupabaseConfigured()) return fail("Supabase가 연결되어 있지 않아요.");
  const mine = await getMyWorkspace();
  if (!mine) return fail("로그인이 필요해요.");
  if (mine.role !== "owner") return fail("승인 취소는 팀장(워크스페이스 관리자)만 할 수 있어요.");

  const supabase = await createClient();
  const loaded = await loadTranslation(supabase, translationId);
  if (!loaded) return fail("번역을 찾지 못했어요. 목록을 새로 고친 뒤 다시 해 주세요.");
  const checked = await supabase
    .from("ad_checks")
    .update({ review_status: "pending", reviewer_id: null, reviewed_at: null })
    .eq("id", loaded.check.id)
    .eq("workspace_id", mine.workspace.id)
    .select("id")
    .maybeSingle();
  if (checked.error || !checked.data) return fail("승인 취소를 저장하지 못했어요.");
  const updated = await supabase.from("review_translations").update({ status: "draft" }).eq("id", translationId);
  if (updated.error) return fail(`승인 취소를 저장하지 못했어요: ${updated.error.message}`);
  return { ok: true, data: { revoked: true } };
}
