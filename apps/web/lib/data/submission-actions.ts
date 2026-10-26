"use server";

// 시안 저장 · 제출 · 제출 취소 · 숨김 · 결재 · AI 분석 팀장 확인 (docs/team-approval-ai-analysis.md 3·4·6장).
// 상태 바꾸기는 DB 함수(rpc)로만 하고, 권한은 DB(RLS · 함수)가 최종으로 막는다. 여기서는 입력 검증과 알기 쉬운 오류 문구를 맡는다.
// workspace_id는 화면 입력을 믿지 않고 로그인한 워크스페이스로 채운다 (DB_RULES 4.1).
import { z } from "zod";
import { Decision, EvidenceRef, type SubmissionTab } from "@/lib/schemas/submission";
import { getAdChecks } from "./index";
import { buildAdSnapshot, buildReviewSnapshot, type VersionSnapshot } from "./submission-bodies";
import { dbError, fail, ownOnSaleProduct, type SubmissionResult, type WriteContext, writeContext } from "./submission-write";

export type { SubmissionResult } from "./submission-write";

/** 시안으로 저장할 때 사람이 적는 칸. 내용(body)은 서버가 만든다 */
const DraftInput = z.object({
  summary: z.string().trim().max(300),
  note: z.string().trim().max(1000).nullable(),
});
export type DraftInput = z.infer<typeof DraftInput>;

const Uuid = z.uuid();

/** 그 제품 × 탭 칸의 시안. 없으면 만든다 (같은 칸에는 숨기지 않은 시안이 하나) */
async function ensureSubmission(ctx: WriteContext, projectId: string, productId: string, tab: SubmissionTab, title: string) {
  const { data: found, error } = await ctx.supabase
    .from("tab_submissions")
    .select("id")
    .eq("workspace_id", ctx.workspaceId)
    .eq("project_id", projectId)
    .eq("product_id", productId)
    .eq("tab", tab)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return fail(dbError(error));
  if (found) return { ok: true as const, id: String(found.id) };
  const { data, error: insertError } = await ctx.supabase
    .from("tab_submissions")
    .insert({ workspace_id: ctx.workspaceId, project_id: projectId, product_id: productId, tab, title })
    .select("id")
    .single();
  if (insertError) return fail(dbError(insertError));
  return { ok: true as const, id: String(data.id) };
}

async function insertVersion(ctx: WriteContext, submissionId: string, snapshot: VersionSnapshot<object>, input: DraftInput) {
  const { data, error } = await ctx.supabase
    .from("submission_versions")
    .insert({
      workspace_id: ctx.workspaceId,
      submission_id: submissionId,
      summary: input.summary,
      note: input.note || null,
      body: snapshot.body,
      evidence: snapshot.evidence,
      data_as_of: snapshot.data_as_of,
    })
    .select("id")
    .single();
  if (error) return fail(dbError(error));
  return { ok: true as const, data: { versionId: String(data.id) } };
}

/** 리뷰 리포트를 시안 새 버전(임시)으로 저장한다 */
export async function saveReviewDraft(productId: string, input: DraftInput): Promise<SubmissionResult<{ versionId: string }>> {
  const parsed = DraftInput.safeParse(input);
  if (!parsed.success) return fail("한 줄 결론은 300자, 메모는 1000자까지예요");
  const ctx = await writeContext();
  if (!ctx.ok) return ctx;
  const target = await ownOnSaleProduct(productId);
  if (!target.ok) return target;
  const snapshot = await buildReviewSnapshot(productId);
  if (snapshot.body.analyzed_count === 0) return fail("AI 분석이 끝난 리뷰가 없어요. 먼저 리뷰를 분석해 주세요");
  const submission = await ensureSubmission(ctx, target.product.project_id, productId, "review", `${target.product.name} 리뷰 분석`);
  if (!submission.ok) return submission;
  return insertVersion(ctx, submission.id, snapshot, parsed.data);
}

/**
 * 광고 검토 건을 시안 새 버전(임시)으로 저장한다.
 * carryOver면 직전 버전(숨기지 않은 최신)에 묶여 있던 검토 건도 함께 담는다 (한 제품의 문구 여러 개를 한 시안으로)
 */
export async function saveAdDraft(
  productId: string,
  adCheckId: string,
  input: DraftInput & { carryOver: boolean },
): Promise<SubmissionResult<{ versionId: string }>> {
  const parsed = DraftInput.safeParse(input);
  if (!parsed.success) return fail("한 줄 결론은 300자, 메모는 1000자까지예요");
  const ctx = await writeContext();
  if (!ctx.ok) return ctx;
  if (!Uuid.safeParse(adCheckId).success) return fail("검토 번호가 올바르지 않아요");
  const target = await ownOnSaleProduct(productId);
  if (!target.ok) return target;
  const submission = await ensureSubmission(ctx, target.product.project_id, productId, "ad", `${target.product.name} 광고 문구`);
  if (!submission.ok) return submission;

  const checkIds = [adCheckId];
  if (input.carryOver) {
    const { data: previous, error } = await ctx.supabase
      .from("submission_versions")
      .select("evidence")
      .eq("submission_id", submission.id)
      .is("deleted_at", null)
      .order("version_no", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return fail(dbError(error));
    const refs = z.array(EvidenceRef).safeParse(previous?.evidence ?? []);
    if (refs.success) checkIds.push(...refs.data.filter((e) => e.kind === "ad_check" && e.id !== adCheckId).map((e) => e.id));
  }
  let snapshot: VersionSnapshot<object>;
  try {
    snapshot = await buildAdSnapshot(productId, checkIds);
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
  return insertVersion(ctx, submission.id, snapshot, parsed.data);
}

/** 임시 버전의 한 줄 결론 · 메모 고치기 (제출한 버전은 DB 트리거가 막는다) */
export async function updateDraft(versionId: string, input: DraftInput): Promise<SubmissionResult> {
  const parsed = DraftInput.safeParse(input);
  if (!parsed.success) return fail("한 줄 결론은 300자, 메모는 1000자까지예요");
  const ctx = await writeContext();
  if (!ctx.ok) return ctx;
  if (!Uuid.safeParse(versionId).success) return fail("버전 번호가 올바르지 않아요");
  const { data, error } = await ctx.supabase
    .from("submission_versions")
    .update({ summary: parsed.data.summary, note: parsed.data.note || null })
    .eq("id", versionId)
    .eq("workspace_id", ctx.workspaceId)
    .select("id")
    .maybeSingle();
  if (error) return fail(dbError(error));
  if (!data) return fail("임시 버전만, 작성자나 팀장이 고칠 수 있어요");
  return { ok: true, data: null };
}

/** 이 버전에서 새 버전 만들기: 내용 · 근거를 그대로 복사한 임시 버전 v+1 */
export async function newVersionFrom(versionId: string): Promise<SubmissionResult<{ versionId: string }>> {
  const ctx = await writeContext();
  if (!ctx.ok) return ctx;
  if (!Uuid.safeParse(versionId).success) return fail("버전 번호가 올바르지 않아요");
  const { data: source, error } = await ctx.supabase
    .from("submission_versions")
    .select("submission_id, summary, note, body, evidence, data_as_of")
    .eq("id", versionId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (error) return fail(dbError(error));
  if (!source) return fail("버전을 찾지 못했어요");
  const evidence = z.array(EvidenceRef).safeParse(source.evidence);
  if (!evidence.success) return fail("버전의 근거 모양이 올바르지 않아요");
  const snapshot = { body: source.body as object, evidence: evidence.data, data_as_of: (source.data_as_of as string | null) ?? null };
  const input = { summary: String(source.summary ?? ""), note: (source.note as string | null) ?? null };
  return insertVersion(ctx, String(source.submission_id), snapshot, input);
}

/** 상태 바꾸기 DB 함수 하나를 부른다. id 하나만 받는 함수들 (submit · withdraw · hide · AI 분석 팀장 확인) */
async function rpcById(name: string, argName: string, id: string): Promise<SubmissionResult> {
  const ctx = await writeContext();
  if (!ctx.ok) return ctx;
  if (!Uuid.safeParse(id).success) return fail("번호가 올바르지 않아요");
  const { error } = await ctx.supabase.rpc(name, { [argName]: id });
  if (error) return fail(dbError(error));
  return { ok: true, data: null };
}

export async function submitVersion(versionId: string): Promise<SubmissionResult> {
  return rpcById("submit_version", "p_version_id", versionId);
}

export async function withdrawVersion(versionId: string): Promise<SubmissionResult> {
  return rpcById("withdraw_version", "p_version_id", versionId);
}

export async function hideVersion(versionId: string): Promise<SubmissionResult> {
  return rpcById("hide_version", "p_version_id", versionId);
}

/**
 * 결재 (팀장만). 반려는 사유 필수.
 * 근거 광고 검토 건에 위험 높음 · 전문가 확인 요청이 있으면 승인할 때 확인 체크를 받는다 (설계 8장 보완 7: 결재가 약기법 검토를 대신하지 않는다)
 */
export async function decideVersion(
  versionId: string,
  decision: Decision,
  reason: string,
  riskAcknowledged: boolean,
): Promise<SubmissionResult> {
  const ctx = await writeContext();
  if (!ctx.ok) return ctx;
  if (ctx.role !== "owner") return fail("승인 · 반려는 팀장(owner)만 할 수 있어요");
  if (!Uuid.safeParse(versionId).success || !Decision.safeParse(decision).success) return fail("입력값을 확인해 주세요");
  const trimmed = reason.trim().slice(0, 1000);
  if (decision === "rejected" && !trimmed) return fail("반려 사유를 적어 주세요");
  if (decision === "approved" && !riskAcknowledged) {
    let risky: boolean;
    try {
      risky = await hasRiskyAdEvidence(ctx, versionId);
    } catch {
      return fail("광고 검토 결과를 확인하지 못했어요. 잠시 후 다시 시도해 주세요");
    }
    if (risky) return fail("위험 높음 · 전문가 확인 요청이 있는 문구예요. 약기법 검토를 확인했다는 체크를 해 주세요");
  }
  const { error } = await ctx.supabase.rpc("decide_version", { p_version_id: versionId, p_decision: decision, p_reason: trimmed || null });
  if (error) return fail(dbError(error));
  return { ok: true, data: null };
}

async function hasRiskyAdEvidence(ctx: WriteContext, versionId: string) {
  const { data, error } = await ctx.supabase.from("submission_versions").select("evidence").eq("id", versionId).maybeSingle();
  if (error || !data) throw new Error("광고 검토 근거를 읽지 못했습니다");
  const refs = z.array(EvidenceRef).safeParse(data?.evidence ?? []);
  if (!refs.success) throw new Error("광고 검토 근거가 올바르지 않습니다");
  const ids = new Set(refs.data.filter((e) => e.kind === "ad_check").map((e) => e.id));
  if (ids.size === 0) return false;
  return (await getAdChecks({ source: "all" })).some(
    (c) => ids.has(c.id) && (c.overall_risk === "high" || c.is_expert_review_requested === true),
  );
}

/** AI 분석 팀장 확인 (팀장만) */
export async function checkAiAnalysis(analysisId: string): Promise<SubmissionResult> {
  return rpcById("check_ai_analysis", "p_analysis_id", analysisId);
}
