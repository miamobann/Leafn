"use server";

// 시안 저장 · 제출 · 제출 취소 · 숨김 · 결재 · AI 분석 팀장 확인 (docs/team-approval-ai-analysis.md 3·4·6장).
// 상태 바꾸기는 DB 함수(rpc)로만 하고, 권한은 DB(RLS · 함수)가 최종으로 막는다. 여기서는 입력 검증과 알기 쉬운 오류 문구를 맡는다.
// workspace_id는 화면 입력을 믿지 않고 로그인한 워크스페이스로 채운다 (DB_RULES 4.1).
import { z } from "zod";
import { AppealTopic } from "@/lib/schemas/review";
import { Decision, EvidenceRef, MarketBody, ReviewBody, type SubmissionTab } from "@/lib/schemas/submission";
import { MARKET_CATEGORIES, MARKET_PLATFORMS, type MarketPlatform } from "@/lib/market-config";
import { summarySnapshot } from "@/app/(internal)/(dashboard)/market/_lib/summary";
import { weekLabel } from "@/app/(internal)/(dashboard)/market/_lib/market";
import { seriesOf } from "@/app/(internal)/(dashboard)/market/_lib/overview";
import { getAdChecks, getGeoSnapshots, getProducts, getSearchSnapshots, getSnsAnalyses, getTrendSnapshots } from "./index";
import { buildAdSnapshot, buildAppeals, buildGuideSnapshot, buildReviewSnapshot, buildTranslations, type VersionSnapshot, withExtras } from "./submission-bodies";
import { dbError, fail, ownOnSaleProduct, type SubmissionResult, type WriteContext, writeContext } from "./submission-write";
import { getCurrentUser } from "./workspace";

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
    .select("id, version_no")
    .single();
  if (error) return fail(dbError(error));
  return { ok: true as const, data: { versionId: String(data.id), versionNo: Number(data.version_no) } };
}

type ReviewDraftChange = {
  /** 한 줄 결론 · 메모. 주면 임시 버전에 함께 쓴다 */
  input?: DraftInput;
  addTopics?: AppealTopic[];
  addTranslationIds?: string[];
  removeTopic?: AppealTopic;
  removeTranslationId?: string;
  /** 주면 지금 담긴 것 대신 이 구성으로 바꾼다 (이전 버전 불러오기) */
  replace?: { topics: AppealTopic[]; translationIds: string[] };
};

/**
 * 리뷰 분석 시안의 임시 버전을 만들거나 고친다. 요약 탭의 「결재 올리기」와 소구점 · 상세페이지용 리뷰의 「시안에 담기」가 모두 여기로 온다.
 * - 내 임시 버전이 가장 최근이면 그 버전을 고치고, 아니면 (제출했거나 승인된 버전 뒤에는) 담았던 것을 이어받은 새 임시 버전을 만든다.
 * - 리포트 숫자는 저장하는 순간의 데이터로 다시 만들고, 담은 소구점 · 후기는 지금도 담을 수 있는지 다시 확인한다.
 */
async function upsertReviewDraft(productId: string, change: ReviewDraftChange): Promise<SubmissionResult<{ versionId: string; versionNo: number }>> {
  const ctx = await writeContext();
  if (!ctx.ok) return ctx;
  const target = await ownOnSaleProduct(productId);
  if (!target.ok) return target;
  const base = await buildReviewSnapshot(productId);
  if (base.body.analyzed_count === 0) return fail("AI 분석이 끝난 리뷰가 없어요. 먼저 리뷰를 분석해 주세요");
  const submission = await ensureSubmission(ctx, target.product.project_id, productId, "review", `${target.product.name} 리뷰 분석`);
  if (!submission.ok) return submission;

  const { data: latest, error } = await ctx.supabase
    .from("submission_versions")
    .select("id, status, author_id, body")
    .eq("submission_id", submission.id)
    .is("deleted_at", null)
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return fail(dbError(error));
  const previous = ReviewBody.safeParse(latest?.body);
  const keptTopics = (change.replace ? change.replace.topics : previous.success ? (previous.data.appeals ?? []).map((a) => a.topic) : []).filter(
    (t) => t !== change.removeTopic,
  );
  const keptTranslationIds = (
    change.replace ? change.replace.translationIds : previous.success ? (previous.data.translations ?? []).map((t) => t.review_translation_id) : []
  ).filter((id) => id !== change.removeTranslationId);

  let snapshot: VersionSnapshot<ReviewBody>;
  try {
    const [keptAppeals, newAppeals, keptTranslations, newTranslations] = await Promise.all([
      buildAppeals(productId, keptTopics, false),
      buildAppeals(productId, change.addTopics ?? [], true),
      buildTranslations(productId, keptTranslationIds, false),
      buildTranslations(productId, change.addTranslationIds ?? [], true),
    ]);
    const appeals = [...new Map([...keptAppeals, ...newAppeals].map((a) => [a.topic, a])).values()];
    const translations = [...new Map([...keptTranslations, ...newTranslations].map((t) => [t.review_translation_id, t])).values()];
    snapshot = withExtras(base, appeals, translations);
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }

  const me = await getCurrentUser();
  if (latest && latest.status === "draft" && me && latest.author_id === me.id) {
    const patch = {
      body: snapshot.body,
      evidence: snapshot.evidence,
      data_as_of: snapshot.data_as_of,
      ...(change.input ? { summary: change.input.summary, note: change.input.note || null } : {}),
    };
    const { data, error: updateError } = await ctx.supabase
      .from("submission_versions")
      .update(patch)
      .eq("id", String(latest.id))
      .eq("workspace_id", ctx.workspaceId)
      .select("id, version_no")
      .maybeSingle();
    if (updateError) return fail(dbError(updateError));
    if (!data) return fail("임시 버전을 고치지 못했어요. 화면을 새로 고쳐 주세요");
    return { ok: true, data: { versionId: String(data.id), versionNo: Number(data.version_no) } };
  }
  return insertVersion(ctx, submission.id, snapshot, change.input ?? { summary: "", note: null });
}

const TopicList = z.array(AppealTopic).max(AppealTopic.options.length);
const TranslationIdList = z.array(z.uuid()).max(200);

/** 리뷰 분석 요약을 시안 새 버전(임시)으로 저장한다 (담아 둔 소구점 · 후기를 함께) */
export async function saveReviewDraft(productId: string, input: DraftInput): Promise<SubmissionResult<{ versionId: string; versionNo: number }>> {
  const parsed = DraftInput.safeParse(input);
  if (!parsed.success) return fail("한 줄 결론은 300자, 메모는 1000자까지예요");
  return upsertReviewDraft(productId, { input: parsed.data });
}

/** 소구점 · 일본어 후기를 이 제품의 임시 버전에 담는다. 요약 탭에서 한 줄 결론을 쓰고 결재를 올린다 */
export async function addToReviewDraft(
  productId: string,
  picks: { topics?: AppealTopic[]; translationIds?: string[] },
): Promise<SubmissionResult<{ versionId: string; versionNo: number }>> {
  const topics = TopicList.safeParse(picks.topics ?? []);
  const translationIds = TranslationIdList.safeParse(picks.translationIds ?? []);
  if (!topics.success || !translationIds.success) return fail("담을 항목을 다시 골라 주세요");
  if (topics.data.length + translationIds.data.length === 0) return fail("담을 항목을 하나 이상 골라 주세요");
  return upsertReviewDraft(productId, { addTopics: topics.data, addTranslationIds: translationIds.data });
}

/**
 * 이전 버전 불러오기: 그 버전의 한 줄 결론 · 메모 · 담은 소구점 · 일본어 후기를 지금 임시 버전으로 복사한다.
 * 원래 버전은 그대로 두고, 리포트 숫자는 지금 데이터로 다시 만든다. 지금 담을 수 없게 된 항목(지운 번역 등)은 빠진다
 */
export async function loadReviewVersion(productId: string, versionId: string): Promise<SubmissionResult<{ versionNo: number; summary: string; note: string }>> {
  const ctx = await writeContext();
  if (!ctx.ok) return ctx;
  if (!Uuid.safeParse(versionId).success) return fail("버전 번호가 올바르지 않아요");
  const { data: source, error } = await ctx.supabase
    .from("submission_versions")
    .select("summary, note, body, submission_id")
    .eq("id", versionId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (error) return fail(dbError(error));
  if (!source) return fail("불러올 버전을 찾지 못했어요");
  // 같은 제품의 리뷰 분석 시안 버전만 불러온다
  const { data: owner, error: ownerError } = await ctx.supabase
    .from("tab_submissions")
    .select("id")
    .eq("id", String(source.submission_id))
    .eq("workspace_id", ctx.workspaceId)
    .eq("product_id", productId)
    .eq("tab", "review")
    .maybeSingle();
  if (ownerError) return fail(dbError(ownerError));
  if (!owner) return fail("이 제품의 리뷰 분석 시안 버전이 아니에요");
  const body = ReviewBody.safeParse(source.body);
  const input = { summary: String(source.summary ?? ""), note: source.note ? String(source.note) : null };
  const saved = await upsertReviewDraft(productId, {
    input,
    replace: {
      topics: body.success ? (body.data.appeals ?? []).map((a) => a.topic) : [],
      translationIds: body.success ? (body.data.translations ?? []).map((t) => t.review_translation_id) : [],
    },
  });
  if (!saved.ok) return saved;
  return { ok: true, data: { versionNo: saved.data.versionNo, summary: input.summary, note: input.note ?? "" } };
}

/** 담은 소구점 하나 또는 일본어 후기 하나를 시안에서 뺀다 (제출한 버전은 그대로 두고 새 임시 버전에서 뺀다) */
export async function removeFromReviewDraft(
  productId: string,
  pick: { topic?: AppealTopic; translationId?: string },
): Promise<SubmissionResult<{ versionId: string; versionNo: number }>> {
  const topic = pick.topic === undefined ? undefined : AppealTopic.safeParse(pick.topic);
  const translationId = pick.translationId === undefined ? undefined : z.uuid().safeParse(pick.translationId);
  if ((topic && !topic.success) || (translationId && !translationId.success)) return fail("뺄 항목을 다시 골라 주세요");
  return upsertReviewDraft(productId, { removeTopic: topic?.data, removeTranslationId: translationId?.data });
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

/**
 * 콘텐츠 가이드 결재 (2026-10-26 A안): 가이드 최신 버전을 그 제품의 광고 검토 시안 새 버전(임시)으로 저장한다.
 * 결재함에는 "콘텐츠 가이드 vN" 한 건으로 보이고, 승인하면 묶인 자동 검사 · 문구 검토의 상태도 같이 바뀐다 (decide_version)
 */
export async function saveGuideDraft(guideId: string, input: DraftInput & { carryOver?: boolean }): Promise<SubmissionResult<{ versionId: string }>> {
  const parsed = DraftInput.safeParse(input);
  if (!parsed.success) return fail("한 줄 결론은 300자, 메모는 1000자까지예요");
  if (!Uuid.safeParse(guideId).success) return fail("가이드 번호가 올바르지 않아요");
  const ctx = await writeContext();
  if (!ctx.ok) return ctx;
  let snapshot: Awaited<ReturnType<typeof buildGuideSnapshot>>;
  try {
    snapshot = await buildGuideSnapshot(guideId);
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
  const target = await ownOnSaleProduct(snapshot.productId);
  if (!target.ok) return target;
  const submission = await ensureSubmission(ctx, target.product.project_id, snapshot.productId, "ad", `${target.product.name} 광고 문구`);
  if (!submission.ok) return submission;
  return insertVersion(ctx, submission.id, snapshot, parsed.data);
}

/**
 * 시장 분석 시안 (2026-10-26): 시장 분석 요약 탭에 보이는 내용(이번 주 핵심 · 알 수 있는 것 · 한눈에 보기)을 그 순간의 데이터로 서버에서 다시 만들어 고정한다.
 * 고정 기준 = 카테고리 · 플랫폼 · 기준 주 · 수집일 (body.summary.basis) + 시안 제품. 결재 문서는 다시 계산하지 않고 이 값을 보여 준다.
 * 시안 칸은 고른 자사 제품 × 시장 분석 (판매 중 제품만). 내 임시 버전이 가장 최근이면 그 버전을 고치고, 아니면 새 버전을 만든다
 */
export async function saveMarketDraft(
  productId: string,
  view: { category: string; platform: string },
  input: DraftInput,
): Promise<SubmissionResult<{ versionId: string; versionNo: number }>> {
  const parsed = DraftInput.safeParse(input);
  if (!parsed.success) return fail("한 줄 결론은 300자, 메모는 1000자까지예요");
  if (!(MARKET_CATEGORIES as readonly string[]).includes(view.category)) return fail("카테고리를 다시 골라 주세요");
  const platform = MARKET_PLATFORMS.find((p) => p.source === view.platform)?.source as MarketPlatform | undefined;
  if (!platform) return fail("플랫폼을 다시 골라 주세요");
  const ctx = await writeContext();
  if (!ctx.ok) return ctx;
  const target = await ownOnSaleProduct(productId);
  if (!target.ok) return target;

  const [snapshots, products, search, geo, snsAll] = await Promise.all([getTrendSnapshots({ source: platform }), getProducts(), getSearchSnapshots(), getGeoSnapshots(), getSnsAnalyses()]);
  // 요약 탭과 같은 입력: 고른 플랫폼 · 카테고리의 랭킹, 그 카테고리의 AI 검색 답변(샘플 여부 포함), 마지막 SNS 분석
  const series = seriesOf(snapshots, platform, view.category);
  const lastRanking = series.at(-1);
  const geoCategory = geo.filter((g) => g.category === view.category);
  const summary = summarySnapshot({
    series,
    products,
    category: view.category,
    search,
    geo,
    geoIsSample: geoCategory.length > 0 && geoCategory.every((g) => g.id.startsWith("geo-")),
    sns: snsAll.filter((r) => r.category === view.category).at(-1) ?? null,
    platform,
    platformLabel: MARKET_PLATFORMS.find((p) => p.source === platform)?.label ?? platform,
    week: lastRanking ? `${weekLabel(lastRanking.captured_at)} 주` : null,
  });
  if (summary.core.length === 0 && summary.points.length === 0 && summary.tiles.every((t) => t.value === "데이터 없음")) {
    return fail("요약에 쓸 데이터가 아직 없어요. 랭킹 CSV를 올리거나 [데이터 업데이트]를 먼저 해 주세요");
  }
  // 근거: 고정한 랭킹 스냅샷(이번 · 직전)과 시안 제품. 실제로 읽은 행만 넣는다 (DB_RULES 4.2)
  const refs: EvidenceRef[] = [...series.slice(-2).map((t) => ({ kind: "trend_snapshot" as const, id: t.id })), { kind: "product" as const, id: productId }];
  // AI 분석은 points를 한 줄씩 읽는다: 이번 주 핵심 · 알 수 있는 것 · 한눈에 보기를 요약 탭에 보이는 글 그대로
  const lines = [
    ...summary.core.map((c) => `${c.label}: ${c.value} — ${c.meaning}${c.sub ? ` · ${c.sub}` : ""}`),
    ...summary.points.map((pt) => `${pt.label}: ${pt.headline} — 할 일: ${pt.action}`),
    ...summary.tiles.map((t) => `${t.title}: ${t.value}${t.label ? ` ${t.label}` : ""} — ${t.lines.join(" · ")}`),
  ];
  const body = MarketBody.parse({ scope: "product", points: lines.map((text) => ({ text, evidence: refs })), summary });
  const dates = [lastRanking?.captured_at, ...search.map((s) => s.captured_at), ...geoCategory.map((g) => g.captured_at)].filter((d): d is string => Boolean(d));
  const snapshot: VersionSnapshot<MarketBody> = { body, evidence: refs, data_as_of: dates.toSorted().at(-1) ?? null };

  const submission = await ensureSubmission(ctx, target.product.project_id, productId, "market", `${target.product.name} 시장 분석`);
  if (!submission.ok) return submission;
  const { data: latest, error } = await ctx.supabase
    .from("submission_versions")
    .select("id, status, author_id")
    .eq("submission_id", submission.id)
    .is("deleted_at", null)
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return fail(dbError(error));
  const me = await getCurrentUser();
  if (latest && latest.status === "draft" && me && latest.author_id === me.id) {
    const { data, error: updateError } = await ctx.supabase
      .from("submission_versions")
      .update({ body: snapshot.body, evidence: snapshot.evidence, data_as_of: snapshot.data_as_of, summary: parsed.data.summary, note: parsed.data.note || null })
      .eq("id", String(latest.id))
      .eq("workspace_id", ctx.workspaceId)
      .select("id, version_no")
      .maybeSingle();
    if (updateError) return fail(dbError(updateError));
    if (!data) return fail("임시 버전을 고치지 못했어요. 화면을 새로 고쳐 주세요");
    return { ok: true, data: { versionId: String(data.id), versionNo: Number(data.version_no) } };
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
