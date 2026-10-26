// 시안 · 결재 · AI 분석 쓰기 함수(Server Action)가 같이 쓰는 준비 · 오류 문구 (서버 전용).
// "use server" 파일은 async 함수만 내보낼 수 있어서 도우미를 여기에 둔다.
import { createClient } from "@/lib/supabase/server";
import { getProduct } from "./index";
import { getMyWorkspace, isSupabaseConfigured } from "./workspace";

export type SubmissionResult<T = null> = { ok: true; data: T } | { ok: false; message: string };

export const fail = (message: string): { ok: false; message: string } => ({ ok: false, message });

const TABLE_MISSING = new Set(["PGRST205", "42P01", "PGRST202"]);

export function dbError(error: { code?: string; message: string }) {
  if (error.code && TABLE_MISSING.has(error.code)) return "시안 · 결재 테이블이 아직 DB에 적용되지 않았어요";
  // DB 함수 · 트리거가 raise exception으로 낸 한국어 문구는 그대로 보여 준다
  if (error.code === "P0001") return error.message;
  if (error.code === "23505") return "같은 칸에 이미 시안이 있어요. 화면을 새로 고쳐 주세요";
  if (error.code === "42501") return "권한이 없어요. 담당 탭이 아니거나 팀장만 할 수 있는 일이에요";
  return `저장하지 못했어요: ${error.message}`;
}

/** 로그인한 워크스페이스와 Supabase 클라이언트. 샘플 모드에서는 쓰지 않는다 */
export async function writeContext() {
  if (!isSupabaseConfigured()) return fail("샘플 모드에서는 저장할 수 없어요");
  const mine = await getMyWorkspace();
  if (!mine) return fail("로그인한 워크스페이스가 없어요");
  return { ok: true as const, workspaceId: mine.workspace.id, role: mine.role, supabase: await createClient() };
}
export type WriteContext = Extract<Awaited<ReturnType<typeof writeContext>>, { ok: true }>;

/** 시안 · AI 분석은 판매 중인 자사 제품(프로젝트에 속한 것)에만 만든다 (설계 2장) */
export async function ownOnSaleProduct(productId: string) {
  const product = await getProduct(productId);
  if (!product || product.kind !== "own" || !product.project_id) return fail("프로젝트에 속한 자사 제품이 아니에요");
  if (product.sale_status !== "on_sale") return fail("판매 중인 제품만 시안 · AI 분석 대상이에요");
  return { ok: true as const, product: { ...product, project_id: product.project_id } };
}
