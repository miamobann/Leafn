"use server";

// 플랫폼 수집 화면의 쓰기 함수 (Server Action). 로그인한 사용자의 세션으로 쓰므로 RLS가 워크스페이스를 가른다.
// 수집 자체는 여기서 하지 않는다: queued 요청만 만들면 수집기(일꾼)가 집어 가서 ready(미리보기)로 만든다 (collectors/collect_to_db.py).
// 저장은 DB의 save_collection_run()이 한다 (미리보기 → products · reviews).
import { z } from "zod";
import { CollectionRunRow, StartCollectionInput } from "@/lib/schemas/collection";
import { createClient } from "@/lib/supabase/server";
import { buildCollectionView, type CollectionView, getOpenCollection, RUN_COLUMNS } from "./collection";
import { getMyWorkspace } from "./workspace";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string };

const fail = (message: string): { ok: false; message: string } => ({ ok: false, message });

async function loadRun(runId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("collection_runs").select(RUN_COLUMNS).eq("id", runId).maybeSingle();
  if (error) throw new Error(`수집 요청을 불러오지 못했습니다: ${error.message}`);
  return { supabase, run: data ? CollectionRunRow.parse(data) : null };
}

/** [경쟁 제품 불러오기]: 수집 요청(queued)을 만든다. 같은 우리 제품의 저장 전 요청은 먼저 지운다 (임시 결과가 쌓이지 않게) */
export async function startCollection(raw: StartCollectionInput): Promise<ActionResult<CollectionView>> {
  const parsed = StartCollectionInput.safeParse(raw);
  if (!parsed.success) return fail("고른 조건이 올바르지 않아요.");
  const input = parsed.data;
  // 수집기가 지원하는 범위 (sources/qoo10.py): Qoo10의 화장수 · 에센스. 라쿠텐은 선택 칸만 있고 가져오지 않는다 (이 프로토타입의 범위)
  if (input.platformId !== "qoo10") {
    return fail("라쿠텐은 이 프로토타입에서 가져오지 않아요. Qoo10을 골라 주세요.");
  }
  const mine = await getMyWorkspace();
  if (!mine) return fail("워크스페이스가 없어요. 먼저 로그인하고 워크스페이스를 만들어 주세요.");

  const supabase = await createClient();
  const open = await supabase.from("collection_runs").select("id, status").eq("own_product_id", input.ownProductId).in("status", ["queued", "running", "ready"]);
  if (open.error) return fail(`수집 요청을 확인하지 못했어요: ${open.error.message}`);
  if (open.data.some((r) => r.status === "running")) return fail("지금 수집 중인 요청이 있어요. 끝난 뒤에 다시 불러와 주세요.");
  if (open.data.length > 0) {
    const gone = await supabase.from("collection_runs").delete().in("id", open.data.map((r) => r.id));
    if (gone.error) return fail(`이전 요청을 지우지 못했어요: ${gone.error.message}`);
  }

  const { data, error } = await supabase
    .from("collection_runs")
    .insert({
      workspace_id: mine.workspace.id,
      platform_id: input.platformId,
      category: input.category,
      own_product_id: input.ownProductId,
      top_n: input.topN,
      stars: input.stars,
      max_star: Math.max(...input.stars), // 옛 칸 (체크한 별점 중 가장 높은 값)
      review_limit: input.reviewLimit,
      status: "queued",
    })
    .select(RUN_COLUMNS)
    .single();
  if (error) return fail(`수집 요청을 만들지 못했어요: ${error.message}`);
  return { ok: true, data: await buildCollectionView(supabase, data) };
}

/** 화면을 열 때: 이 우리 제품의 가장 최근 미리보기를 되살린다. 없으면 null */
export async function restoreCollection(ownProductId: string): Promise<ActionResult<CollectionView | null>> {
  return { ok: true, data: await getOpenCollection(z.string().min(1).parse(ownProductId)) };
}

/** 진행 상황 확인 (화면이 몇 초마다 부른다) */
export async function pollCollection(runId: string): Promise<ActionResult<CollectionView>> {
  const { supabase, run } = await loadRun(z.string().min(1).parse(runId));
  if (!run) return fail("수집 요청이 사라졌어요. 다시 불러와 주세요.");
  return { ok: true, data: await buildCollectionView(supabase, run) };
}

/**
 * [저장]: 고른 제품만 남기고 미리보기를 확정한다.
 * save_collection_run()은 요청에 남은 제품을 모두 저장하므로, 고르지 않은 제품은 먼저 미리보기에서 뺀다 (임시 리뷰도 함께 지워진다).
 */
export async function saveCollection(runId: string, keepIds: string[]): Promise<ActionResult<CollectionView>> {
  const ids = z.array(z.string().min(1)).safeParse(keepIds);
  if (!ids.success || ids.data.length === 0) return fail("저장할 제품을 선택해 주세요.");
  const { supabase, run } = await loadRun(runId);
  if (!run) return fail("수집 요청이 사라졌어요. 다시 불러와 주세요.");
  if (run.status !== "ready") return fail("미리보기 상태가 아니라 저장할 수 없어요.");

  const keep = new Set(ids.data);
  const all = await supabase.from("collection_run_products").select("id").eq("run_id", run.id);
  if (all.error) return fail(`제품 목록을 불러오지 못했어요: ${all.error.message}`);
  const drop = all.data.map((r) => r.id as string).filter((id) => !keep.has(id));
  if (drop.length > 0) {
    const dropped = await supabase.from("collection_run_products").delete().in("id", drop);
    if (dropped.error) return fail(`선택하지 않은 제품을 빼지 못했어요: ${dropped.error.message}`);
  }

  const saved = await supabase.rpc("save_collection_run", { p_run_id: run.id });
  if (saved.error) return fail(`저장하지 못했어요: ${saved.error.message}`);
  const after = await loadRun(run.id);
  if (!after.run) return fail("저장은 끝났지만 결과를 불러오지 못했어요.");
  return { ok: true, data: await buildCollectionView(after.supabase, after.run) };
}

/** 저장하지 않고 닫기: 요청을 지운다 (제품별 결과와 임시 리뷰도 함께 지워진다) */
export async function discardCollection(runId: string): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { error } = await supabase.from("collection_runs").delete().eq("id", z.string().min(1).parse(runId)).in("status", ["queued", "ready", "failed"]);
  if (error) return fail(`지우지 못했어요: ${error.message}`);
  return { ok: true, data: null };
}
