// POST /api/content-guide: 콘텐츠 제작 가이드 ① 제목 3개(대량 등급) / ② 고른 제목으로 본문(정밀 등급) + 금지어 검사 + 약기법 판정 + content_guides 자동 저장.
import { NextResponse } from "next/server";
import { z } from "zod";
import { AdCheckParseError } from "@/lib/ai/ad-check/judge";
import { AiCallError } from "@/lib/ai/client";
import { AiConfigError } from "@/lib/ai/config";
import { checkBody } from "@/lib/ai/content-guide/check";
import { ContentGuideParseError, generateBody, generateTitles } from "@/lib/ai/content-guide/generate";
import { getMyWorkspace, isSupabaseConfigured } from "@/lib/data/workspace";
import { ContentGuideInput, GuideTitle } from "@/lib/schemas/content-guide";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60; // 본문 + 판정에 20~40초 걸린다

const MAX_BODY_BYTES = 32 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const Request = z.discriminatedUnion("step", [
  z.object({ step: z.literal("titles"), input: ContentGuideInput, product_id: z.string().optional() }),
  z.object({ step: z.literal("body"), input: ContentGuideInput, picked: GuideTitle, product_id: z.string().optional() }),
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
  const detail = e instanceof AiCallError ? `status=${e.status} code=${e.code}` : e instanceof Error ? e.message.replace(/sk-[A-Za-z0-9_\-*.]+/g, "sk-***") : "unknown";
  console.error(`[api/content-guide] ${e instanceof Error ? e.name : "Error"}: ${detail}`);
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
    const checked = await checkBody(req.input.channel, { name: p.name, product_category: p.category, ingredients: p.ingredients_ja }, made.result);
    const checks = checked.blocks.map((b) => ({ key: b.key, action: b.line.action, findings: b.line.findings.map((f) => ({ text: f.text, reason: f.reason })) }));

    if (mine) {
      const supabase = await createClient();
      const { error: dbErr } = await supabase.from("content_guides").insert({
        workspace_id: mine.workspace.id,
        product_id: req.product_id && UUID_RE.test(req.product_id) ? req.product_id : null,
        channel: req.input.channel,
        post_type: req.input.post_type,
        input: req.input,
        title: req.picked,
        body: made.result,
        lint_hits: made.lintHits,
        ad_check_id: null,
        model: made.model,
        prompt_version: `content-guide.${made.promptVersion}`,
      });
      if (dbErr) return fail(500, "결과를 DB에 저장하지 못했습니다. 관리자에게 테이블 적용 상태와 권한을 확인해 주세요.");
    }

    return NextResponse.json({
      body: made.result,
      lintHits: made.lintHits,
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
