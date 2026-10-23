// POST /api/ad-check (CLAUDE.md 6장): 광고 문구 → 줄별 위험 표현·사유·근거·대체 표현·번역 (정밀 등급).
// 아직 ad_checks 에 저장하지 않고 결과만 돌려준다 (저장은 DB 단계에서 추가).
import { NextResponse } from "next/server";
import { AiCallError } from "@/lib/ai/client";
import { AiConfigError } from "@/lib/ai/config";
import { AdCheckParseError, judgeLines } from "@/lib/ai/ad-check/judge";
import { splitInputLines } from "@/lib/ai/ad-check/input";
import { toAdCheck } from "@/lib/ai/ad-check/to-ad-check";
import { createClient } from "@/lib/supabase/server";
import { AdCheckRequest } from "@/lib/schemas/ad-check-ai";

export const maxDuration = 60; // 20줄 판정에 10초 안팎 걸린다

const MAX_BODY_BYTES = 64 * 1024;

/**
 * 로그인 확인. middleware 와 같은 기준이다: Supabase 를 연결하지 않은 로컬이면 통과하고, 연결돼 있으면 로그인한 사용자만 통과한다.
 * 확인 중에 오류가 나면 막는다 (실패 시 차단).
 */
async function isAllowed(): Promise<boolean> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return true;
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
    const result = await judgeLines({ product: body.data.product, usage: body.data.usage, lines });
    const check = toAdCheck({
      id: crypto.randomUUID(),
      workspaceId: body.data.workspace_id,
      createdAt: new Date().toISOString(),
      lines,
      judged: result.lines,
      usage: body.data.usage,
      model: result.model,
      promptVersion: `ad-check.${result.promptVersion}`,
    });
    return NextResponse.json({
      check,
      meta: { model: result.model, promptVersion: check.prompt_version, usage: result.usage, attempts: result.attempts, warnings: result.warnings },
    });
  } catch (e) {
    logFailure(e);
    // 화면에 보내는 문구는 아래에서 고른 것만 쓴다 (제공사 오류 원문·키·요청 내용은 보내지 않는다)
    if (e instanceof AiConfigError) return fail(503, e.message);
    if (e instanceof AiCallError) return fail(502, e.message);
    if (e instanceof AdCheckParseError) return fail(502, e.message);
    return fail(500, "AI 판정에 실패했습니다");
  }
}
