// POST /api/content-guide/[guideId]/revise: 새 검토에서 고친 문구를 「가이드에 반영」 → 수정본(content_guides 새 행, parent_id = 원본).
// 원본은 덮어쓰지 않는다 (약기법에 걸린 문구와 그 검사 기록을 증거로 남김, docs/tab3-db-plan.md 1장 2026-10-26).
// 약기법 우선: 고친 줄은 그 검토가 낸 대체 표현 중 재검토를 통과한 것만 받고, 「고쳐야 함」 줄은 그대로 반영하지 않는다. AI는 다시 부르지 않는다.
import { NextResponse } from "next/server";
import { z } from "zod";
import { guideSlots, slotText, TITLE_SLOT } from "@/app/(internal)/(dashboard)/ad-check/_lib/guide-to-review";
import { lintBody } from "@/lib/ai/content-guide/lint";
import { getAdCheck, getContentGuide } from "@/lib/data";
import { getMyWorkspace, isSupabaseConfigured } from "@/lib/data/workspace";
import { createClient } from "@/lib/supabase/server";

const Request = z.object({
  ad_check_id: z.uuid(),
  /** 줄 번호(1부터) → 고른 대체 표현 */
  picks: z.record(z.string().regex(/^\d+$/), z.string().min(1).max(500)),
});

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request, { params }: { params: Promise<{ guideId: string }> }) {
  if (!isSupabaseConfigured()) return fail(409, "DB가 연결되지 않아 반영할 수 없습니다.");
  const mine = await getMyWorkspace();
  if (!mine) return fail(401, "로그인이 필요합니다");
  const { guideId } = await params;
  if (!z.uuid().safeParse(guideId).success) return fail(400, "가이드 번호가 올바르지 않습니다.");
  const parsed = Request.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, "입력이 올바르지 않습니다");
  const { ad_check_id: checkId, picks } = parsed.data;

  const [found, check] = await Promise.all([getContentGuide(guideId), getAdCheck(checkId)]);
  if (!found || found.guide.workspace_id !== mine.workspace.id) return fail(404, "가이드를 찾을 수 없습니다.");
  if (!check || check.workspace_id !== mine.workspace.id) return fail(404, "검토 기록을 찾을 수 없습니다. 판정이 저장됐는지 확인해 주세요.");
  const parent = found.guide;
  const slots = guideSlots(parent);
  const lines = check.line_results ?? [];
  if (lines.length !== slots.length) return fail(409, `가이드는 ${slots.length}줄인데 검토는 ${lines.length}줄이에요. 줄을 더하거나 지우지 말고 다시 판정해 주세요.`);

  // 줄마다 반영할 문구와 한국어 뜻
  const finals = new Map<string, { ja: string; ko: string }>();
  for (const [i, line] of lines.entries()) {
    const slot = slots[i]!;
    const pick = picks[String(line.line_index)];
    if (pick) {
      const recheck = check.findings
        .filter((f) => f.line_index === line.line_index)
        .flatMap((f) => f.suggestion_rechecks ?? [])
        .find((s) => s.text === pick && s.recheck === "pass");
      if (!recheck) return fail(422, `${line.line_index}번째 줄: 재검토를 통과한 대체 표현만 반영할 수 있어요.`);
      finals.set(slot.key, { ja: pick, ko: recheck.text_ko ?? line.back_translation_ko ?? "" });
      continue;
    }
    if (line.action === "must_fix") return fail(422, `${line.line_index}번째 줄은 「고쳐야 함」이에요. 대체 표현을 골라 주세요.`);
    // 고치지 않은 줄: 처음 문구 그대로면 원래 한국어 뜻, 입력칸에서 직접 고친 줄이면 그 판정의 역번역
    const original = slot.key === TITLE_SLOT ? parent.title.title_ko : (parent.body.blocks.find((b) => b.key === slot.key)?.options[0]?.text_ko ?? "");
    finals.set(slot.key, { ja: line.original, ko: line.original === slot.text ? original : (line.back_translation_ko ?? "") });
  }

  const title = finals.get(TITLE_SLOT);
  const body = {
    ...parent.body,
    // 반영한 블록은 판정한 안 하나만 남긴다 (나머지 안은 판정하지 않았다)
    blocks: parent.body.blocks.map((b) => {
      const f = finals.get(b.key);
      return f ? { ...b, options: [{ text_ja: slotText(f.ja), text_ko: slotText(f.ko) }] } : b;
    }),
  };
  const id = crypto.randomUUID();
  const supabase = await createClient();
  const { error } = await supabase.from("content_guides").insert({
    id,
    workspace_id: mine.workspace.id,
    product_id: parent.product_id,
    promo_event_id: parent.promo_event_id,
    channel: parent.channel,
    post_type: parent.post_type,
    input: parent.input,
    title: title ? { ...parent.title, title_ja: slotText(title.ja), title_ko: slotText(title.ko) } : parent.title,
    body,
    lint_hits: lintBody(body),
    ad_check_id: check.id,
    parent_id: parent.id,
    memos: parent.memos ?? null,
    model: parent.model,
    prompt_version: parent.prompt_version,
  });
  if (error) return fail(500, "수정본을 저장하지 못했습니다. 관리자에게 DB 적용 상태(20261026180000)를 확인해 주세요.");
  return NextResponse.json({ id });
}
