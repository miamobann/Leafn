// POST /api/ad-check (CLAUDE.md 6장): 광고 문구 → 줄별 위험 표현·사유·근거·대체 표현·번역 (정밀 등급) → ad_checks 자동 저장.
import { NextResponse } from "next/server";
import { AiCallError } from "@/lib/ai/client";
import { AiConfigError } from "@/lib/ai/config";
import { AdCheckParseError, judgeLines } from "@/lib/ai/ad-check/judge";
import { splitInputLines } from "@/lib/ai/ad-check/input";
import { toAdCheck } from "@/lib/ai/ad-check/to-ad-check";
import { getMyWorkspace, isSupabaseConfigured } from "@/lib/data/workspace";
import { createClient } from "@/lib/supabase/server";
import { AdCheckRequest } from "@/lib/schemas/ad-check-ai";

export const maxDuration = 60; // 20줄 판정에 10초 안팎 걸린다

const MAX_BODY_BYTES = 64 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/** 서버 로그에는 키처럼 보이는 문자열을 가려서 남긴다 */
function logFailure(e: unknown) {
  const detail = e instanceof AiCallError ? `status=${e.status} code=${e.code}` : e instanceof Error ? e.message.replace(/sk-[A-Za-z0-9_\-*.]+/g, "sk-***") : "unknown";
  console.error(`[api/ad-check] ${e instanceof Error ? e.name : "Error"}: ${detail}`);
}

export async function POST(request: Request) {
  if (!(await isAllowed())) return fail(401, "로그인이 필요합니다");

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return fail(413, "요청이 너무 큽니다");
  const json: unknown = await request.json().catch(() => null);
  const body = AdCheckRequest.safeParse(json);
  if (!body.success) return fail(400, "입력이 올바르지 않습니다");

  const lines = splitInputLines(body.data.text);
  if (lines.length === 0) return fail(400, "검토할 문구가 없습니다");

  try {
    const mine = isSupabaseConfigured() ? await getMyWorkspace() : null;
    if (isSupabaseConfigured() && !mine) return fail(403, "워크스페이스에 참여한 뒤 다시 시도해 주세요.");
    const workspaceId = mine?.workspace.id ?? body.data.workspace_id;
    const result = await judgeLines({ product: body.data.product, usage: body.data.usage, lines });
    const check = toAdCheck({
      id: crypto.randomUUID(),
      workspaceId,
      createdAt: new Date().toISOString(),
      lines,
      judged: result.lines,
      productId: body.data.product_id,
      usage: body.data.usage,
      model: result.model,
      promptVersion: `ad-check.${result.promptVersion}`,
    });

    if (mine) {
      const supabase = await createClient();
      const { error: dbErr } = await supabase.from("ad_checks").insert({
        id: check.id,
        created_at: check.created_at,
        workspace_id: workspaceId,
        product_id: check.product_id && UUID_RE.test(check.product_id) ? check.product_id : null,
        input_text: check.input_text,
        input_lang: check.input_lang,
        usage: check.usage ?? null,
        product_category: body.data.product.product_category ?? null,
        overall_risk: check.overall_risk ?? null,
        overall_action: check.overall_action ?? null,
        findings: check.findings,
        line_results: check.line_results ?? [],
        translated_text: (check.line_results ?? []).map((l) => l.translated_text).filter(Boolean).join("\n") || null,
        back_translation_ko: (check.line_results ?? []).map((l) => l.back_translation_ko).filter(Boolean).join("\n") || null,
        localized_note: (check.line_results ?? []).map((l) => l.localized_note).filter(Boolean).join("\n") || null,
        final_text: check.input_text,
        review_status: check.review_status,
        is_expert_review_requested: check.is_expert_review_requested ?? false,
        model: check.model,
        prompt_version: check.prompt_version,
      });
      if (dbErr) return fail(500, "결과를 DB에 저장하지 못했습니다. 관리자에게 테이블 적용 상태와 권한을 확인해 주세요.");
    }

    return NextResponse.json({
      check,
      saved: Boolean(mine),
      meta: { model: result.model, promptVersion: check.prompt_version, usage: result.usage, attempts: result.attempts, warnings: result.warnings },
    });
  } catch (e) {
    logFailure(e);
    if (e instanceof AiConfigError) return fail(503, e.message);
    if (e instanceof AiCallError) return fail(502, e.message);
    if (e instanceof AdCheckParseError) return fail(502, e.message);
    return fail(500, "AI 판정에 실패했습니다");
  }
}
