"use server";

// 프로모션 캘린더 쓰기 (Server Action). 연결 환경에서는 promo_events · promo_milestones에 저장한다.
// 권한은 테이블의 RLS("members insert/update/delete")대로 팀원 누구나 고칠 수 있다 (calendar-edit 제안, 2026-10-26 결정).
// Supabase 환경 변수가 없는 샘플 모드에서는 입력만 검증해 돌려주고(saved: false), 화면이 로컬 상태로 반영한다.
// workspace_id는 화면 입력을 믿지 않고 로그인한 워크스페이스로 채운다 (DB_RULES 4.1).
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PlatformId, platformLabel } from "@/lib/platforms";
import { PlatformNotePatch } from "@/lib/schemas/platform";
import { MilestoneInput, PromoEventInput, PromoEventPatch } from "@/lib/schemas/promo";
import { createClient } from "@/lib/supabase/server";
import type { MilestoneView, PromoEventView } from "./launch";
import { getMyWorkspace, isSupabaseConfigured } from "./workspace";

export type LaunchResult<T = null> = { ok: true; data: T; saved: boolean } | { ok: false; message: string };

const Uuid = z.uuid();
const fail = (message: string): { ok: false; message: string } => ({ ok: false, message });

function dbError(error: { code?: string; message: string }) {
  if (error.code === "PGRST205" || error.code === "42P01") return "캘린더 테이블을 찾지 못했어요";
  if (error.code === "42501") return "이 워크스페이스의 일정을 고칠 권한이 없어요";
  if (error.code === "23514") return "입력을 확인해 주세요 (이름이 비었거나 종료일이 시작일보다 빨라요)";
  return `저장하지 못했어요: ${error.message}`;
}

/** 연결 환경이면 Supabase와 워크스페이스, 샘플 모드면 null */
async function writeContext() {
  if (!isSupabaseConfigured()) return null;
  const mine = await getMyWorkspace();
  if (!mine) return fail("로그인한 워크스페이스가 없어요");
  return { ok: true as const, workspaceId: mine.workspace.id, supabase: await createClient() };
}

/** 홈 캘린더 · 할 일 목록과 전체보기가 다음에 열릴 때 바뀐 일정을 읽게 한다 */
function refreshCalendar() {
  revalidatePath("/");
  revalidatePath("/calendar");
}

export async function updatePlatformNote(id: string, patch: PlatformNotePatch) {
  return { id, ...PlatformNotePatch.parse(patch) };
}

export async function createPromoEvent(input: PromoEventInput): Promise<LaunchResult<PromoEventView>> {
  const parsed = PromoEventInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력을 확인해 주세요");
  const e = parsed.data;
  const ctx = await writeContext();

  if (!ctx) {
    const id = `draft-${e.start_date}-${e.title}`;
    return {
      ok: true,
      saved: false,
      data: {
        id,
        platformKey: e.platform,
        platformName: e.platform ?? "자사 캠페인",
        kind: e.kind,
        title: e.title,
        startDate: e.start_date,
        endDate: e.end_date,
        milestones: e.milestones.map((m, i) => ({ id: `${id}-m${i}`, label: m.label, dueDate: m.due_date, done: false })),
        adCheck: null,
        isConfirmed: e.is_confirmed,
        linkedAdChecks: 0,
      },
    };
  }
  if (!ctx.ok) return ctx;
  // platform_id에는 코드 상수(lib/platforms.ts)의 slug만 넣는다 (DB_RULES 4.1)
  if (e.platform && !PlatformId.safeParse(e.platform).success) return fail("등록되지 않은 플랫폼이에요");

  const { data: event, error } = await ctx.supabase
    .from("promo_events")
    .insert({
      workspace_id: ctx.workspaceId,
      platform_id: e.platform,
      kind: e.kind,
      title: e.title,
      start_date: e.start_date,
      end_date: e.end_date,
      is_confirmed: e.is_confirmed,
    })
    .select("id")
    .single();
  if (error) return fail(dbError(error));
  const eventId = String(event.id);

  let milestones: MilestoneView[] = [];
  if (e.milestones.length > 0) {
    const { data: rows, error: milestoneError } = await ctx.supabase
      .from("promo_milestones")
      .insert(e.milestones.map((m) => ({ workspace_id: ctx.workspaceId, promo_event_id: eventId, label: m.label, due_date: m.due_date })))
      .select("id, label, due_date");
    if (milestoneError) {
      // 마감을 못 넣었으면 행사도 지워서 반쯤 만든 일정이 남지 않게 한다
      await ctx.supabase.from("promo_events").delete().eq("id", eventId).eq("workspace_id", ctx.workspaceId);
      return fail(dbError(milestoneError));
    }
    milestones = rows.map((m) => ({ id: String(m.id), label: String(m.label), dueDate: String(m.due_date), done: false }));
  }
  refreshCalendar();
  return {
    ok: true,
    saved: true,
    data: {
      id: eventId,
      platformKey: e.platform,
      platformName: e.platform ? platformLabel(e.platform) : "자사 캠페인",
      kind: e.kind,
      title: e.title,
      startDate: e.start_date,
      endDate: e.end_date,
      milestones,
      adCheck: null,
      isConfirmed: e.is_confirmed,
      linkedAdChecks: 0,
    },
  };
}

/** 행사 이름 · 날짜 · 확정 여부 고치기 */
export async function updatePromoEvent(id: string, patch: PromoEventPatch): Promise<LaunchResult> {
  const parsed = PromoEventPatch.safeParse(patch);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력을 확인해 주세요");
  const ctx = await writeContext();
  if (!ctx) return { ok: true, saved: false, data: null };
  if (!ctx.ok) return ctx;
  if (!Uuid.safeParse(id).success) return fail("행사 번호가 올바르지 않아요");
  const { data, error } = await ctx.supabase
    .from("promo_events")
    .update(parsed.data)
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .select("id")
    .maybeSingle();
  if (error) return fail(dbError(error));
  if (!data) return fail("행사를 찾지 못했어요");
  refreshCalendar();
  return { ok: true, saved: true, data: null };
}

/** 행사 삭제. 준비 마감은 함께 지워지고, 연결된 광고 검토 · 콘텐츠 가이드는 행사 연결만 끊긴다 (DB의 on delete 규칙) */
export async function deletePromoEvent(id: string): Promise<LaunchResult> {
  const ctx = await writeContext();
  if (!ctx) return { ok: true, saved: false, data: null };
  if (!ctx.ok) return ctx;
  if (!Uuid.safeParse(id).success) return fail("행사 번호가 올바르지 않아요");
  const { data, error } = await ctx.supabase
    .from("promo_events")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .select("id")
    .maybeSingle();
  if (error) return fail(dbError(error));
  if (!data) return fail("행사를 찾지 못했어요");
  refreshCalendar();
  return { ok: true, saved: true, data: null };
}

/** 준비 마감 추가 */
export async function addMilestone(eventId: string, input: MilestoneInput): Promise<LaunchResult<MilestoneView>> {
  const parsed = MilestoneInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력을 확인해 주세요");
  const ctx = await writeContext();
  if (!ctx) {
    return { ok: true, saved: false, data: { id: `${eventId}-draft-${parsed.data.due_date}-${parsed.data.label}`, label: parsed.data.label, dueDate: parsed.data.due_date, done: false } };
  }
  if (!ctx.ok) return ctx;
  if (!Uuid.safeParse(eventId).success) return fail("행사 번호가 올바르지 않아요");
  const { data, error } = await ctx.supabase
    .from("promo_milestones")
    .insert({ workspace_id: ctx.workspaceId, promo_event_id: eventId, label: parsed.data.label, due_date: parsed.data.due_date })
    .select("id, label, due_date")
    .single();
  if (error) return fail(dbError(error));
  refreshCalendar();
  return { ok: true, saved: true, data: { id: String(data.id), label: String(data.label), dueDate: String(data.due_date), done: false } };
}

/** 준비 마감 이름 · 날짜 고치기 */
export async function updateMilestone(id: string, input: MilestoneInput): Promise<LaunchResult> {
  const parsed = MilestoneInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력을 확인해 주세요");
  return updateMilestoneRow(id, parsed.data);
}

/** 준비 마감 완료 체크 (done_at에 시각, 해제하면 비운다) */
export async function setMilestoneDone(id: string, done: boolean): Promise<LaunchResult> {
  return updateMilestoneRow(id, { done_at: done ? new Date().toISOString() : null });
}

async function updateMilestoneRow(id: string, values: Record<string, unknown>): Promise<LaunchResult> {
  const ctx = await writeContext();
  if (!ctx) return { ok: true, saved: false, data: null };
  if (!ctx.ok) return ctx;
  if (!Uuid.safeParse(id).success) return fail("마감 번호가 올바르지 않아요");
  const { data, error } = await ctx.supabase
    .from("promo_milestones")
    .update(values)
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .select("id")
    .maybeSingle();
  if (error) return fail(dbError(error));
  if (!data) return fail("마감을 찾지 못했어요");
  refreshCalendar();
  return { ok: true, saved: true, data: null };
}

/** 준비 마감 삭제 */
export async function deleteMilestone(id: string): Promise<LaunchResult> {
  const ctx = await writeContext();
  if (!ctx) return { ok: true, saved: false, data: null };
  if (!ctx.ok) return ctx;
  if (!Uuid.safeParse(id).success) return fail("마감 번호가 올바르지 않아요");
  const { data, error } = await ctx.supabase
    .from("promo_milestones")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspaceId)
    .select("id")
    .maybeSingle();
  if (error) return fail(dbError(error));
  if (!data) return fail("마감을 찾지 못했어요");
  refreshCalendar();
  return { ok: true, saved: true, data: null };
}
