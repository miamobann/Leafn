"use server";

// 리뷰 가져오기 화면의 우리 제품 리뷰 CSV 저장 (Server Action). 로그인한 사용자의 세션으로 쓰므로 RLS가 워크스페이스를 가른다.
// 파일은 브라우저가 읽고(Papa Parse), 여기에는 열을 맞춘 행만 묶음(최대 500줄)으로 온다.
// 같은 리뷰는 (workspace_id, source, external_id)로 한 번만 들어간다: 이미 있으면 건너뛰고 건너뛴 수를 돌려준다.
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { ReviewImportInput, type ReviewImportRow } from "@/lib/schemas/review";
import { createClient } from "@/lib/supabase/server";
import { getMyWorkspace, isSupabaseConfigured } from "./workspace";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string };

const fail = (message: string): { ok: false; message: string } => ({ ok: false, message });

/** 리뷰를 넣을 수 있는 우리 제품: 내 워크스페이스의 자사 제품 중 판매중인 것 (개발중 제품은 리뷰가 없어 뺀다) */
export type ImportOwnProduct = { id: string; brand: string; name: string; category: string; volumeMl: number | null };

export async function getImportOwnProducts(): Promise<ImportOwnProduct[]> {
  if (!isSupabaseConfigured() || !(await getMyWorkspace())) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, brand, name, category, volume_ml")
    .eq("kind", "own")
    .eq("sale_status", "on_sale")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`우리 제품을 불러오지 못했습니다: ${error.message}`);
  return data.map((p) => ({
    id: p.id,
    brand: p.brand,
    name: p.name,
    category: p.category ?? "",
    volumeMl: p.volume_ml === null ? null : Number(p.volume_ml),
  }));
}

/** 리뷰 번호 열이 없으면 제품 · 날짜 · 평점 · 본문으로 만든 해시 앞 32자를 external_id로 쓴다 (같은 파일을 다시 올려도 같은 값) */
function externalIdOf(productId: string, origin: string, row: ReviewImportRow) {
  // 올리브영 번호는 나중에 수집기가 같은 번호로 넣을 수 있게 그대로 둔다. 자사몰 · 기타는 출처끼리 번호가 겹치지 않게 앞에 붙인다
  if (row.review_no) return origin === "oliveyoung" ? row.review_no : `${origin}-${row.review_no}`;
  return createHash("sha256").update(`${productId}|${row.posted_date}|${row.rating}|${row.body}`).digest("hex").slice(0, 32);
}

/** [리뷰 N건 저장]: 한 묶음(최대 500줄)을 저장한다. 화면은 파일 전체를 묶음으로 나눠 차례로 부른다 */
export async function saveReviewsFromCsv(raw: ReviewImportInput): Promise<ActionResult<{ inserted: number; skipped: number }>> {
  const parsed = ReviewImportInput.safeParse(raw);
  if (!parsed.success) return fail("저장할 리뷰의 형식이 올바르지 않아요. 열 연결을 다시 확인해 주세요.");
  const input = parsed.data;
  const mine = await getMyWorkspace();
  if (!mine) return fail("워크스페이스가 없어요. 먼저 로그인하고 워크스페이스를 만들어 주세요.");

  const supabase = await createClient();
  const product = await supabase.from("products").select("id, kind, sale_status").eq("id", input.productId).eq("workspace_id", mine.workspace.id).maybeSingle();
  if (product.error) return fail(`제품을 확인하지 못했어요: ${product.error.message}`);
  if (!product.data || product.data.kind !== "own" || product.data.sale_status !== "on_sale") {
    return fail("판매중인 우리 제품에만 리뷰를 넣을 수 있어요. 제품을 다시 골라 주세요.");
  }

  // 같은 파일 안에 같은 리뷰가 두 번 있으면 한 번만 보낸다 (뺀 줄은 건너뜀으로 센다)
  const records = new Map<string, Record<string, unknown>>();
  for (const row of input.rows) {
    const externalId = externalIdOf(input.productId, input.origin, row);
    if (records.has(externalId)) continue;
    const attrs = { ...(row.skin_type ? { skin_type: row.skin_type } : {}), ...(row.age_group ? { age_group: row.age_group } : {}) };
    records.set(externalId, {
      workspace_id: mine.workspace.id,
      product_id: input.productId,
      source: input.source,
      external_id: externalId,
      lang: input.lang,
      rating: row.rating,
      rating_scale: 5,
      body: row.body,
      posted_at: `${row.posted_date}T00:00:00+09:00`, // 날짜만 있으면 그날 0시 (한국 시간)
      reviewer_attrs: Object.keys(attrs).length > 0 ? attrs : null,
      raw: { ...row.raw, origin: input.origin, file_name: input.fileName },
    });
  }

  const { data, error } = await supabase
    .from("reviews")
    .upsert([...records.values()], { onConflict: "workspace_id,source,external_id", ignoreDuplicates: true })
    .select("id");
  if (error) return fail(`리뷰를 저장하지 못했어요: ${error.message}`);
  // 저장한 리뷰가 리뷰 리포트에 바로 보이게 화면 캐시를 비운다 (새로고침 없이)
  if (data.length > 0) revalidatePath("/", "layout");
  return { ok: true, data: { inserted: data.length, skipped: input.rows.length - data.length } };
}
