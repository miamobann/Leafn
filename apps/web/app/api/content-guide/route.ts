// POST /api/content-guide: 콘텐츠 제작 가이드 ① 제목 3개(대량 등급) / ② 고른 제목으로 본문(정밀 등급) + 금지어 검사 + 약기법 판정.
// 저장하지 않고 결과만 돌려준다. 키는 서버에서만 쓰고, 오류 문구는 아래에서 고른 것만 보낸다.
import { NextResponse } from "next/server";
import { z } from "zod";
import { AdCheckParseError } from "@/lib/ai/ad-check/judge";
import { AiCallError } from "@/lib/ai/client";
import { AiConfigError } from "@/lib/ai/config";
import { checkBody } from "@/lib/ai/content-guide/check";
import { ContentGuideParseError, generateBody, generateTitles } from "@/lib/ai/content-guide/generate";
import { ContentGuideInput, GuideTitle } from "@/lib/schemas/content-guide";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60; // 본문 + 판정에 20~40초 걸린다

const MAX_BODY_BYTES = 32 * 1024;

const Request = z.discriminatedUnion("step", [
  z.object({ step: z.literal("titles"), input: ContentGuideInput }),
  z.object({ step: z.literal("body"), input: ContentGuideInput, picked: GuideTitle }),
]);

/** 로그인 확인 (POST /api/ad-check 와 같은 기준): Supabase 를 연결하지 않은 로컬이면 통과 */
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
    if (req.step === "titles") {
      const made = await generateTitles(req.input);
      return NextResponse.json({ titles: made.result.titles, meta: { model: made.model, promptVersion: made.promptVersion, usage: made.usage } });
    }
    const made = await generateBody(req.input, req.picked);
    const p = req.input.product;
    const checked = await checkBody(req.input.channel, { name: p.name, product_category: p.category, ingredients: p.ingredients_ja }, made.result);
    return NextResponse.json({
      body: made.result,
      lintHits: made.lintHits,
      checks: checked.blocks.map((b) => ({ key: b.key, action: b.line.action, findings: b.line.findings.map((f) => ({ text: f.text, reason: f.reason })) })),
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
