"use server";

// 경쟁제품 CSV 등록 (Server Action, 시장 분석 · 경쟁제품 탭). 로그인한 사용자의 세션으로 쓰므로 RLS가 워크스페이스를 가른다.
// 파일은 브라우저가 읽고(lib/external/competitor-csv.ts), 여기에는 열을 맞춘 행만 온다.
// 같은 제품은 (workspace_id, platform_id, external_id)로 한 번만: 이미 있으면 가격·용량·성분을 갱신한다.
// 수집기가 만든 제품이면 그 source_raw(순위·리뷰 수 등)는 지우지 않고 csv_import만 더한다. title_ai(제품명 정리)는 건드리지 않는다
import { CompetitorImportInput } from "@/lib/schemas/product";
import { createClient } from "@/lib/supabase/server";
import { getMyWorkspace, isSupabaseConfigured } from "./workspace";

/** 데모 플랫폼 (DB_RULES 4.2: lib/platforms.ts의 slug만) */
const PLATFORM_ID = "qoo10";

export type CompetitorImportResult =
  | { ok: true; data: { inserted: number; updated: number; linked: number } }
  | { ok: false; message: string; sampleMode?: boolean };

const fail = (message: string): CompetitorImportResult => ({ ok: false, message });

export async function saveCompetitorsFromCsv(raw: CompetitorImportInput): Promise<CompetitorImportResult> {
  // Supabase 연결이 없는 샘플 모드: 저장하지 않고 화면에만 더한다
  if (!isSupabaseConfigured()) return { ok: false, sampleMode: true, message: "샘플 모드라 저장하지 않고 이 화면에만 추가했어요" };
  const parsed = CompetitorImportInput.safeParse(raw);
  if (!parsed.success) return fail("저장할 제품의 형식이 올바르지 않아요. CSV를 다시 확인해 주세요.");
  const input = parsed.data;
  const mine = await getMyWorkspace();
  if (!mine) return fail("워크스페이스가 없어요. 먼저 로그인하고 워크스페이스를 만들어 주세요.");
  const workspaceId = mine.workspace.id;
  const supabase = await createClient();

  // 연결할 자사 제품은 이 워크스페이스의 kind = own 이어야 한다 (product_competitors 규칙, check로 못 걸어 여기서 확인)
  if (input.ownProductId) {
    const own = await supabase.from("products").select("id, kind").eq("id", input.ownProductId).eq("workspace_id", workspaceId).maybeSingle();
    if (own.error) return fail(`자사 제품을 확인하지 못했어요: ${own.error.message}`);
    if (!own.data || own.data.kind !== "own") return fail("연결할 자사 제품을 다시 골라 주세요.");
  }

  // 이미 있는 제품: source_raw를 합치고, 자사 제품 코드와 겹치면 막는다
  const codes = input.rows.map((r) => r.external_id);
  const existing = await supabase
    .from("products")
    .select("external_id, kind, source_raw")
    .eq("workspace_id", workspaceId)
    .eq("platform_id", PLATFORM_ID)
    .in("external_id", codes);
  if (existing.error) return fail(`기존 제품을 확인하지 못했어요: ${existing.error.message}`);
  const before = new Map(existing.data.map((p) => [p.external_id as string, p]));
  const ownClash = existing.data.filter((p) => p.kind === "own").map((p) => p.external_id);
  if (ownClash.length > 0) return fail(`자사 제품과 같은 상품코드가 있어요: ${ownClash.join(", ")}. 그 줄을 빼고 다시 올려 주세요.`);

  const importedAt = new Date().toISOString();
  const records = input.rows.map((r) => {
    const prev = before.get(r.external_id)?.source_raw;
    const prevRaw = prev && typeof prev === "object" && !Array.isArray(prev) ? (prev as Record<string, unknown>) : {};
    return {
      workspace_id: workspaceId,
      kind: "competitor",
      brand: r.brand,
      name: r.name,
      category: input.category,
      platform_id: PLATFORM_ID,
      external_id: r.external_id,
      url: r.url,
      price_jpy: r.price_jpy,
      price_kind: "regular",
      volume_ml: r.volume_ml,
      ingredients: r.ingredients,
      features: r.key_ingredients_ko ? [`핵심 성분: ${r.key_ingredients_ko}`] : [],
      source_raw: {
        ...prevRaw,
        csv_import: {
          file_name: input.fileName,
          imported_at: importedAt,
          sale_price_jpy: r.sale_price_jpy,
          coupon_price_jpy: r.coupon_price_jpy,
          key_ingredients_ko: r.key_ingredients_ko,
          row: r.raw,
        },
      },
      collected_at: importedAt,
    };
  });

  const saved = await supabase.from("products").upsert(records, { onConflict: "workspace_id,platform_id,external_id" }).select("id, external_id");
  if (saved.error) return fail(`제품을 저장하지 못했어요: ${saved.error.message}`);

  let linked = 0;
  if (input.ownProductId) {
    const links = saved.data.map((p) => ({ workspace_id: workspaceId, own_product_id: input.ownProductId, competitor_product_id: p.id }));
    const link = await supabase.from("product_competitors").upsert(links, { onConflict: "own_product_id,competitor_product_id", ignoreDuplicates: true }).select("id");
    if (link.error) return fail(`제품은 저장했지만 자사 제품과 연결하지 못했어요: ${link.error.message}`);
    linked = link.data.length;
  }

  const updated = saved.data.filter((p) => before.has(p.external_id as string)).length;
  return { ok: true, data: { inserted: saved.data.length - updated, updated, linked } };
}
