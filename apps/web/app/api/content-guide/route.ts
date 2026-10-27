// POST /api/content-guide: 콘텐츠 제작 가이드 ① 제목 3개(대량 등급) / ② 고른 제목으로 본문(정밀 등급) + 금지어 검사 + 약기법 판정 + content_guides 자동 저장.
import { NextResponse } from "next/server";
import { z } from "zod";
import { AdCheckParseError } from "@/lib/ai/ad-check/judge";
import { AiCallError } from "@/lib/ai/client";
import { AiConfigError } from "@/lib/ai/config";
import { type BodyCheck, checkBody, dropFlaggedHashtags } from "@/lib/ai/content-guide/check";
import { toAdCheck } from "@/lib/ai/ad-check/to-ad-check";
import { ContentGuideParseError, generateBody, generateTitles } from "@/lib/ai/content-guide/generate";
import { finalizeHashtags, makeFill } from "@/app/(internal)/(dashboard)/ad-check/_lib/guide-report";
import { lintBody } from "@/lib/ai/content-guide/lint";
import { getAdProducts } from "@/lib/data/ad-products";
import { getMyWorkspace, isSupabaseConfigured } from "@/lib/data/workspace";
import { ContentGuideInput, GuideTitle } from "@/lib/schemas/content-guide";
import { createClient } from "@/lib/supabase/server";

// 본문(정밀) + 약기법 판정(재시도 포함) + 걸린 해시태그 재판정이 60초를 넘겨 배포 화면에서 504가 났다 (2026-10-27). GEO 측정과 같은 한도
export const maxDuration = 300;

const MAX_BODY_BYTES = 32 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const Request = z.discriminatedUnion("step", [
  z.object({ step: z.literal("titles"), input: ContentGuideInput, product_id: z.string().optional(), promo_event_id: z.string().optional() }),
  // promo_event_id: 메가와리 게시물이면 고른 캘린더 행사 (content_guides.promo_event_id 로 남긴다)
  z.object({ step: z.literal("body"), input: ContentGuideInput, picked: GuideTitle, product_id: z.string().optional(), promo_event_id: z.string().optional() }),
]);

/** 로그인 확인 (POST /api/ad-check 와 같은 기준): Supabase 를 연결하지 않은 로컬이면 통과 */
async function isAllowed(): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user !== null;
  } catch {
    return false;
  }
}

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

function logFailure(e: unknown) {
  // 응답 모양 오류는 어디가 틀렸는지(cause: Zod · JSON · 줄 빠짐)를 같이 남긴다 (2026-10-27: 원인 없이 「판정하지 못했습니다」만 찍혔다)
  const cause = e instanceof Error && e.cause instanceof Error ? ` | cause: ${e.cause.message.slice(0, 500)}` : "";
  const detail = e instanceof AiCallError ? `status=${e.status} code=${e.code}` : e instanceof Error ? `${e.message}${cause}`.replace(/sk-[A-Za-z0-9_\-*.]+/g, "sk-***") : "unknown";
  console.error(`[api/content-guide] ${e instanceof Error ? e.name : "Error"}: ${detail}`);
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** 콘텐츠 가이드 판정을 검토 기록으로 남긴다. 블록 한 개 = 한 줄 (block_key 로 어느 블록인지). 판정할 블록이 없으면 null */
async function saveGuideCheck(supabase: Supabase, workspaceId: string, productId: string | null, category: ContentGuideInput["product"]["category"], checked: BodyCheck): Promise<string | null> {
  if (checked.blocks.length === 0 || !checked.model || !checked.promptVersion) return null;
  const check = toAdCheck({
    id: crypto.randomUUID(),
    workspaceId,
    createdAt: new Date().toISOString(),
    lines: checked.blocks.map((b) => b.text),
    judged: checked.blocks.map((b) => b.line),
    usage: checked.adUsage,
    model: checked.model,
    promptVersion: `ad-check.${checked.promptVersion}`,
  });
  const { error } = await supabase.from("ad_checks").insert({
    id: check.id,
    created_at: check.created_at,
    workspace_id: workspaceId,
    source: "content_guide",
    product_id: productId,
    input_text: check.input_text,
    input_lang: check.input_lang,
    usage: check.usage ?? null,
    product_category: category,
    overall_risk: check.overall_risk ?? null,
    overall_action: check.overall_action ?? null,
    review_status: check.review_status,
    model: check.model,
    prompt_version: check.prompt_version,
  });
  if (error) throw new Error(`ad_checks 저장 실패: ${error.message}`);
  const lineRows = (check.line_results ?? []).map((line, i) => ({
    workspace_id: workspaceId,
    ad_check_id: check.id,
    line_index: line.line_index,
    block_key: checked.blocks[i]!.key,
    original: line.original,
    action: line.action,
    findings: check.findings.filter((f) => f.line_index === line.line_index),
    ingredient_check: line.ingredient_check,
    translated_text: line.translated_text,
    back_translation_ko: line.back_translation_ko,
    localized_note: line.localized_note,
  }));
  const { error: lineErr } = await supabase.from("ad_check_lines").insert(lineRows);
  if (lineErr) throw new Error(`ad_check_lines 저장 실패: ${lineErr.message}`);
  return check.id;
}

export async function POST(request: Request) {
  if (!(await isAllowed())) return fail(401, "로그인이 필요합니다");
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return fail(413, "요청이 너무 큽니다");
  const parsed = Request.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, "입력이 올바르지 않습니다");
  const req = parsed.data;

  try {
    const mine = isSupabaseConfigured() ? await getMyWorkspace() : null;
    if (isSupabaseConfigured() && !mine) return fail(403, "워크스페이스에 참여한 뒤 다시 시도해 주세요.");
    if (req.step === "titles") {
      const made = await generateTitles(req.input);
      return NextResponse.json({ titles: made.result.titles, meta: { model: made.model, promptVersion: made.promptVersion, usage: made.usage } });
    }
    const made = await generateBody(req.input, req.picked);
    const p = req.input.product;
    // 자동 검사는 실제로 게시될 문장으로: {product_ja} 같은 자리표시자를 그 제품 값으로 바꿔 판정한다 (결과물은 자리표시자 그대로 저장, 화면·PDF 가 채운다)
    const own = (await getAdProducts()).find((x) => x.id === req.product_id);
    const fill = own ? makeFill(own) : (t: string) => t;
    // 인스타그램 검색어 태그는 화면이 아니라 여기서 붙여, 아래 금지어 검사 · 판정을 같이 거친다 (2026-10-27)
    const tagged = { ...made.result, hashtags: finalizeHashtags(made.result.hashtags, req.input.channel, req.input.keywords.search) };
    const lintHits = lintBody(tagged);
    const filled = { ...tagged, blocks: tagged.blocks.map((b) => ({ ...b, options: b.options.map((o) => ({ ...o, text_ja: fill(o.text_ja) })) })) };
    const judgeProduct = { name: p.name, product_category: p.category, ingredients: p.ingredients_ja };
    const first = await checkBody(req.input.channel, judgeProduct, filled, {}, fill(req.picked.title_ja));
    // 걸린 해시태그는 빼고 남은 태그만 다시 판정한다 (해시태그는 문구 검토로 고칠 수 없어서, 2026-10-27)
    const cleaned = await dropFlaggedHashtags(req.input.channel, judgeProduct, tagged, lintHits, first);
    const checked = cleaned.checked;
    const result = { ...tagged, hashtags: cleaned.body.hashtags };
    const checks = checked.blocks.map((b) => ({ key: b.key, action: b.line.action, findings: b.line.findings.map((f) => ({ text: f.text, reason: f.reason })) }));

    let id: string | null = null;
    let checkSaved = true;
    if (mine) {
      const supabase = await createClient();
      const productId = req.product_id && UUID_RE.test(req.product_id) ? req.product_id : null;
      // 1) 약기법 판정 기록 (ad_checks.source = content_guide). 실패해도 결과물은 저장하고 화면에 알린다 (수연 결정 2026-10-25)
      const adCheckId = await saveGuideCheck(supabase, mine.workspace.id, productId, req.input.product.category, checked).catch((e: unknown) => {
        logFailure(e);
        return null;
      });
      checkSaved = adCheckId !== null || checked.blocks.length === 0;
      // 2) 결과물
      id = crypto.randomUUID();
      const { error: dbErr } = await supabase.from("content_guides").insert({
        id,
        workspace_id: mine.workspace.id,
        product_id: productId,
        promo_event_id: req.promo_event_id && UUID_RE.test(req.promo_event_id) ? req.promo_event_id : null,
        channel: req.input.channel,
        post_type: req.input.post_type,
        input: req.input,
        title: req.picked,
        body: result,
        lint_hits: cleaned.lintHits,
        ad_check_id: adCheckId,
        model: made.model,
        prompt_version: `content-guide.${made.promptVersion}`,
      });
      if (dbErr) return fail(500, "결과를 DB에 저장하지 못했습니다. 관리자에게 테이블 적용 상태와 권한을 확인해 주세요.");
    }

    return NextResponse.json({
      id,
      checkSaved,
      body: result,
      lintHits: cleaned.lintHits,
      checks,
      meta: { model: made.model, promptVersion: made.promptVersion, usage: made.usage, checkUsage: checked.usage },
    });
  } catch (e) {
    logFailure(e);
    if (e instanceof AiConfigError) return fail(503, e.message);
    if (e instanceof AiCallError) return fail(502, e.message);
    if (e instanceof ContentGuideParseError || e instanceof AdCheckParseError) return fail(502, e.message);
    return fail(500, "AI 제작에 실패했습니다");
  }
}
