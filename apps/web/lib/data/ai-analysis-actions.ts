"use server";

// 통합 AI 분석 실행 · 저장 (docs/team-approval-ai-analysis.md 3장 5~6, 7장 4단계). 멤버 누구나 실행하고 결과는 팀 전체가 본다.
// 입력은 그 제품의 탭별 승인본 하나씩(시장 분석은 프로젝트 전체 시안도 가능). 고른 버전이 정말 승인본인지 서버에서 다시 확인한다.
import { z } from "zod";
import { AiCallError } from "@/lib/ai/client";
import { AiConfigError } from "@/lib/ai/config";
import { IntegratedAnalysisParseError } from "@/lib/ai/integrated-analysis/parse";
import type { IntegratedInputVersion } from "@/lib/ai/integrated-analysis/prompt";
import { runIntegratedAnalysis } from "@/lib/ai/integrated-analysis/run";
import { getApprovedVersionsFor } from "./submissions";
import { dbError, fail, ownOnSaleProduct, type SubmissionResult, writeContext } from "./submission-write";

const VersionIds = z.array(z.uuid()).min(1).max(3);

export async function runAiAnalysis(productId: string, versionIds: string[]): Promise<SubmissionResult<{ analysisId: string }>> {
  const ctx = await writeContext();
  if (!ctx.ok) return ctx;
  const ids = VersionIds.safeParse(versionIds);
  if (!ids.success) return fail("탭마다 승인본을 하나씩, 1~3개 골라 주세요");
  const target = await ownOnSaleProduct(productId);
  if (!target.ok) return target;
  const { product } = target;

  const candidates = (await getApprovedVersionsFor(product.project_id, product.id)).flatMap(({ submission, approved }) =>
    approved.map((version) => ({ version, submission })),
  );
  const picked = ids.data.map((id) => candidates.find((c) => c.version.id === id));
  if (picked.some((p) => !p)) return fail("이 제품의 승인본만 고를 수 있어요");
  const chosen = picked.filter((p): p is (typeof candidates)[number] => Boolean(p));
  if (new Set(chosen.map((c) => c.submission.tab)).size !== chosen.length) return fail("탭마다 승인본은 하나만 고를 수 있어요");

  const versions: IntegratedInputVersion[] = chosen.map(({ version, submission }) => ({
    id: version.id,
    ref: `${submission.tab}@v${version.version_no}`,
    tab: submission.tab,
    summary: version.summary,
    body: version.body,
    data_as_of: version.data_as_of,
  }));

  let run;
  try {
    run = await runIntegratedAnalysis({
      product: { name: product.name, skin_line: product.skin_line ?? null, sale_status: product.sale_status },
      versions,
    });
  } catch (e) {
    if (e instanceof AiConfigError) return fail(`AI 설정을 확인해 주세요: ${e.message}`);
    if (e instanceof AiCallError || e instanceof IntegratedAnalysisParseError) return fail(e.message);
    throw e;
  }

  const { data, error } = await ctx.supabase
    .from("ai_analyses")
    .insert({
      workspace_id: ctx.workspaceId,
      project_id: product.project_id,
      product_id: product.id,
      title: `${product.name} 통합 분석`,
      input_version_ids: versions.map((v) => v.id),
      result: run.result,
      summary: run.result.summary,
      model: run.model,
      prompt_version: run.promptVersion,
    })
    .select("id")
    .single();
  if (error) return fail(dbError(error));
  return { ok: true, data: { analysisId: String(data.id) } };
}
