import { cache } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getMyWorkspace, isSupabaseConfigured } from "./workspace";

/** 요청 안에서만 재사용한다. 다른 사용자의 세션/조회 결과를 공유하지 않는다. */
export const dataContext = cache(async () => {
  if (!isSupabaseConfigured()) return null;
  const mine = await getMyWorkspace();
  if (!mine) throw new Error("로그인 후 워크스페이스에 참여해 주세요.");
  return { client: await createClient(), workspaceId: mine.workspace.id };
});

export class TableMissing extends Error {}

export function missingTableOnly(error: unknown): [] {
  if (error instanceof TableMissing) return [];
  throw error;
}

const Row = z.record(z.string(), z.unknown());
/** RLS에 더해 현재 팀으로 제한하고, 1,000행 제한으로 집계가 잘리지 않게 페이지를 읽는다. */
export const readRows = cache(async (table: string) => {
  const context = await dataContext();
  if (!context) return null;
  const rows: z.infer<typeof Row>[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await context.client.from(table).select("*")
      .eq("workspace_id", context.workspaceId).order("id").range(offset, offset + 999);
    if (error?.code === "PGRST205" || error?.code === "42P01") throw new TableMissing(`${table} 테이블 적용이 필요합니다.`);
    if (error) throw new Error(`${table} 조회 실패: ${error.message}`);
    const page = z.array(Row).parse(data);
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
});
