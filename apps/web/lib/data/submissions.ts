// 탭별 시안 · 버전 · 결재 · AI 분석 읽기 (docs/team-approval-ai-analysis.md).
// 연결 환경에서는 현재 팀의 DB를 읽고, 환경 변수가 없는 개발 환경만 샘플(lib/mock/submissions.ts)을 쓴다.
// 테이블이 아직 원격 DB에 적용되지 않았으면 빈 목록이다 (다른 탭과 같은 missingTableOnly).
// 상태 바꾸기(제출 · 결재 · 숨김)는 DB 함수로만 하므로 여기에는 읽기만 둔다.
import { mock } from "@/lib/mock";
import { AiAnalysis } from "@/lib/schemas/ai-analysis";
import {
  AdBody,
  MemberTab,
  SubmissionReview,
  SubmissionTab,
  SubmissionVersion,
  TabSubmission,
  type VersionStatus,
} from "@/lib/schemas/submission";
import { dataContext, missingTableOnly, readRows } from "./db";
import { getMembers, getProducts } from "./index";
import { getToday } from "./launch";
import { getCurrentUser, getMyWorkspace } from "./workspace";

const byNewest = (a: { created_at: string }, b: { created_at: string }) => b.created_at.localeCompare(a.created_at);

export async function getMemberTabs(): Promise<MemberTab[]> {
  const rows = await readRows("member_tabs").catch(missingTableOnly);
  return rows ? rows.map((r) => MemberTab.parse(r)) : mock.memberTabs;
}

/** 내가 시안을 올릴 수 있는 탭. 팀장(owner)은 모든 탭이다 (DB의 has_tab()과 같은 규칙). 샘플 모드는 팀장으로 본다 */
export async function getMyTabs(): Promise<{ role: "owner" | "member"; tabs: SubmissionTab[] }> {
  if (!(await dataContext())) return { role: "owner", tabs: SubmissionTab.options };
  const [mine, user] = await Promise.all([getMyWorkspace(), getCurrentUser()]);
  if (mine?.role === "owner") return { role: "owner", tabs: SubmissionTab.options };
  const tabs = (await getMemberTabs()).filter((t) => t.user_id === user?.id).map((t) => t.tab);
  return { role: "member", tabs: SubmissionTab.options.filter((tab) => tabs.includes(tab)) };
}

/** 숨기지 않은 시안. productId에 null을 주면 프로젝트 전체 시안만 */
export async function getSubmissions(
  opts: { projectId?: string; productId?: string | null; tab?: SubmissionTab } = {},
): Promise<TabSubmission[]> {
  const rows = await readRows("tab_submissions").catch(missingTableOnly);
  return (rows ? rows.map((r) => TabSubmission.parse(r)) : mock.tabSubmissions)
    .filter(
      (s) =>
        !s.deleted_at &&
        (!opts.projectId || s.project_id === opts.projectId) &&
        (opts.productId === undefined || s.product_id === opts.productId) &&
        (!opts.tab || s.tab === opts.tab),
    )
    .toSorted(byNewest);
}

export async function getSubmission(id: string) {
  return (await getSubmissions()).find((s) => s.id === id) ?? null;
}

/** 숨기지 않은 버전 전체 */
async function getAllVersions(): Promise<SubmissionVersion[]> {
  const rows = await readRows("submission_versions").catch(missingTableOnly);
  return (rows ? rows.map((r) => SubmissionVersion.parse(r)) : mock.submissionVersions).filter((v) => !v.deleted_at);
}

/** 시안의 숨기지 않은 버전, 최신 번호부터 */
export async function getSubmissionVersions(submissionId: string): Promise<SubmissionVersion[]> {
  return (await getAllVersions())
    .filter((v) => v.submission_id === submissionId)
    .toSorted((a, b) => b.version_no - a.version_no);
}

/** 콘텐츠 가이드별 결재 상태 (광고 시안 중 가이드로 올린 버전, 가이드 id → 그 가이드의 가장 최근 버전 상태). 검토 기록 화면이 쓴다 */
export async function getGuideApprovalStates(): Promise<Map<string, VersionStatus>> {
  const adIds = new Set((await getSubmissions({ tab: "ad" })).map((s) => s.id));
  const out = new Map<string, { at: string; status: VersionStatus }>();
  for (const v of await getAllVersions()) {
    if (!adIds.has(v.submission_id)) continue;
    const guide = AdBody.safeParse(v.body);
    if (!guide.success || !guide.data.guide) continue;
    const id = guide.data.guide.guide_id;
    const prev = out.get(id);
    if (!prev || v.created_at > prev.at) out.set(id, { at: v.created_at, status: v.status });
  }
  return new Map([...out].map(([id, x]) => [id, x.status]));
}

/** 결재 기록. versionIds를 주면 그 버전들의 기록만, 최근 결재부터 */
export async function getSubmissionReviews(opts: { versionIds?: string[] } = {}): Promise<SubmissionReview[]> {
  const rows = await readRows("submission_reviews").catch(missingTableOnly);
  return (rows ? rows.map((r) => SubmissionReview.parse(r)) : mock.submissionReviews)
    .filter((r) => !opts.versionIds || opts.versionIds.includes(r.version_id))
    .toSorted((a, b) => b.decided_at.localeCompare(a.decided_at));
}

/** 숨기지 않은 AI 분석, 최근 것부터. 결과 모양이 지금 스키마와 맞지 않는 행(예전 프롬프트 버전)은 뺀다 */
export async function getAiAnalyses(opts: { projectId?: string; productId?: string } = {}): Promise<AiAnalysis[]> {
  const rows = await readRows("ai_analyses").catch(missingTableOnly);
  const analyses = rows
    ? rows.flatMap((r) => {
        const parsed = AiAnalysis.safeParse(r);
        return parsed.success ? [parsed.data] : [];
      })
    : mock.aiAnalyses;
  return analyses
    .filter(
      (a) =>
        !a.deleted_at &&
        (!opts.projectId || a.project_id === opts.projectId) &&
        (!opts.productId || a.product_id === opts.productId),
    )
    .toSorted(byNewest);
}

export async function getAiAnalysis(id: string) {
  return (await getAiAnalyses()).find((a) => a.id === id) ?? null;
}

// 결재함 · 버전 미리보기 · 진행 표 · AI 분석 선택 화면이 같이 쓰는 조합 (설계 3장, 7장 3·4단계)

/** 버전 하나를 화면에 보일 때 함께 필요한 이름들 */
async function names() {
  const [members, products] = await Promise.all([getMembers(), getProducts({ kind: "own" })]);
  return {
    member: (userId: string | null) => members.find((m) => m.user_id === userId)?.display_name ?? "—",
    product: (productId: string | null) =>
      productId ? (products.find((p) => p.id === productId)?.name ?? "—") : PROJECT_SCOPE_LABEL,
  };
}

/** 제품을 비운 시안(시장 분석 프로젝트 전체)의 표시 이름 */
export const PROJECT_SCOPE_LABEL = "프로젝트 전체";

/** 날짜 문자열(YYYY-MM-DD) 사이의 날 수 */
function daysBetween(from: string, to: string) {
  const day = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86_400_000;
  return Math.max(0, day(to) - day(from));
}

/** 결재 대기가 이 날 수를 넘으면 강조한다 (설계 8장 보완 4) */
export const STALE_REVIEW_DAYS = 2;

/**
 * 시안 버전을 만든 원본 탭 화면 (#submission은 그 화면의 시안 패널).
 * 리뷰 = 그 제품의 리뷰 리포트, 광고 = 콘텐츠 가이드 상세(가이드로 올린 시안) 또는 버전에 담긴 첫 검토 건, 시장 분석 = 시장 분석 요약 맨 아래 시안 패널
 */
export function sourceHref(submission: TabSubmission, version: SubmissionVersion): string {
  if (submission.tab === "review" && submission.product_id) return `/reviews/${submission.product_id}#submission`;
  // 콘텐츠 가이드로 올린 광고 시안은 그 가이드 상세의 시안 패널로
  const guide = submission.tab === "ad" ? AdBody.safeParse(version.body) : null;
  if (guide?.success && guide.data.guide) return `/ad-check/guide/history/${guide.data.guide.guide_id}#submission`;
  const ad = submission.tab === "ad" ? version.evidence.find((e) => e.kind === "ad_check") : undefined;
  if (ad) return `/ad-check/${ad.id}#submission`;
  return "/market#summary";
}

export type InboxRow = {
  version: SubmissionVersion;
  submission: TabSubmission;
  productName: string;
  authorName: string;
  waitingDays: number;
  sourceHref: string;
  /** 같은 시안의 바로 앞 버전 내용 (결재함에서 바로 미리보기할 때 달라진 곳 표시) */
  previousBody: Record<string, unknown> | null;
};

export type DecisionRow = {
  review: SubmissionReview;
  version: SubmissionVersion;
  submission: TabSubmission;
  productName: string;
  reviewerName: string;
};

/** 결재함(팀장만): 결재 대기 버전(오래 기다린 것부터)과 최근 결재 기록 */
export async function getApprovalInbox(opts: { recentLimit?: number } = {}): Promise<{ pending: InboxRow[]; recent: DecisionRow[] }> {
  const [submissions, versions, reviews, label, today] = await Promise.all([
    getSubmissions(),
    getAllVersions(),
    getSubmissionReviews(),
    names(),
    getToday(),
  ]);
  const submissionOf = new Map(submissions.map((s) => [s.id, s]));
  const versionOf = new Map(versions.map((v) => [v.id, v]));
  const pending = versions.flatMap((v) => {
    const submission = submissionOf.get(v.submission_id);
    if (v.status !== "submitted" || !submission) return [];
    const previous = versions
      .filter((p) => p.submission_id === v.submission_id && p.version_no < v.version_no)
      .toSorted((a, b) => b.version_no - a.version_no)[0];
    return [{
      version: v,
      submission,
      productName: label.product(submission.product_id),
      authorName: label.member(v.author_id),
      waitingDays: daysBetween((v.submitted_at ?? v.created_at).slice(0, 10), today),
      sourceHref: sourceHref(submission, v),
      previousBody: previous?.body ?? null,
    }];
  });
  const recent = reviews.slice(0, opts.recentLimit ?? 20).flatMap((review) => {
    const version = versionOf.get(review.version_id);
    const submission = version ? submissionOf.get(version.submission_id) : undefined;
    if (!version || !submission) return [];
    return [{ review, version, submission, productName: label.product(submission.product_id), reviewerName: label.member(review.reviewer_id) }];
  });
  return { pending: pending.toSorted((a, b) => b.waitingDays - a.waitingDays), recent };
}

export type MyVersionRow = {
  version: SubmissionVersion;
  submission: TabSubmission;
  productName: string;
  sourceHref: string;
  /** 그 버전의 가장 최근 결재 (없으면 아직 결재 전) */
  decision: SubmissionReview | null;
  reviewerName: string | null;
};

/**
 * 내 시안: 내가 만든 버전 전체와 팀장 검토 상황, 최근 것부터 (팀원이 결재함 대신 보는 화면).
 * 샘플 모드는 로그인 사용자가 없어 샘플 버전 전체를 보여 준다
 */
export async function getMySubmissions(): Promise<MyVersionRow[]> {
  const [submissions, versions, reviews, label, me] = await Promise.all([
    getSubmissions(),
    getAllVersions(),
    getSubmissionReviews(),
    names(),
    getCurrentUser(),
  ]);
  const submissionOf = new Map(submissions.map((s) => [s.id, s]));
  return versions
    .filter((v) => !me || v.author_id === me.id)
    .flatMap((version) => {
      const submission = submissionOf.get(version.submission_id);
      if (!submission) return [];
      const decision = reviews.find((r) => r.version_id === version.id) ?? null;
      return [{
        version,
        submission,
        productName: label.product(submission.product_id),
        sourceHref: sourceHref(submission, version),
        decision,
        reviewerName: decision ? label.member(decision.reviewer_id) : null,
      }];
    })
    .toSorted((a, b) => (b.version.submitted_at ?? b.version.created_at).localeCompare(a.version.submitted_at ?? a.version.created_at));
}

/** 버전 미리보기: 버전 · 시안 · 같은 시안의 다른 버전 · 바로 앞 버전 · 결재 기록 */
export async function getVersionDetail(versionId: string) {
  const versions = await getAllVersions();
  const version = versions.find((v) => v.id === versionId);
  if (!version) return null;
  const submission = await getSubmission(version.submission_id);
  if (!submission) return null;
  const history = versions.filter((v) => v.submission_id === submission.id).toSorted((a, b) => b.version_no - a.version_no);
  const previous = history.find((v) => v.version_no < version.version_no) ?? null;
  const [decisions, label] = await Promise.all([getSubmissionReviews({ versionIds: history.map((v) => v.id) }), names()]);
  return {
    version,
    submission,
    history,
    previous,
    decisions,
    productName: label.product(submission.product_id),
    memberName: label.member,
  };
}

/** AI 분석에 고를 수 있는 승인본: 그 제품의 시안 + 같은 프로젝트의 프로젝트 전체 시장 분석 시안 (설계 8장 보완 6) */
export async function getApprovedVersionsFor(projectId: string, productId: string) {
  const [submissions, versions] = await Promise.all([getSubmissions({ projectId }), getAllVersions()]);
  const targets = submissions.filter((s) => s.product_id === productId || (s.product_id === null && s.tab === "market"));
  return targets.map((submission) => ({
    submission,
    approved: versions
      .filter((v) => v.submission_id === submission.id && v.status === "approved")
      .toSorted((a, b) => b.version_no - a.version_no),
  }));
}

export type ProgressCell = { submission: TabSubmission; latestVersionId: string | null } | null;

/** 진행 표 (설계 3장 D안 · CLAUDE.md L): 판매 중 자사 제품 × 탭의 시안 상태와 최근 AI 분석 */
export async function getProgressGrid(projectId: string) {
  const [products, submissions, versions, analyses] = await Promise.all([
    getProducts({ kind: "own" }),
    getSubmissions({ projectId }),
    getAllVersions(),
    getAiAnalyses({ projectId }),
  ]);
  const latestVersion = (submissionId: string) =>
    versions.filter((v) => v.submission_id === submissionId).toSorted((a, b) => b.version_no - a.version_no)[0]?.id ?? null;
  const cell = (productId: string | null, tab: SubmissionTab): ProgressCell => {
    const submission = submissions.find((s) => s.product_id === productId && s.tab === tab);
    return submission ? { submission, latestVersionId: latestVersion(submission.id) } : null;
  };
  const onSale = products.filter((p) => p.project_id === projectId && p.sale_status === "on_sale");
  return {
    projectRow: { market: cell(null, "market") },
    rows: onSale.map((p) => ({
      productId: p.id,
      productName: p.name,
      cells: { market: cell(p.id, "market"), review: cell(p.id, "review"), ad: cell(p.id, "ad") },
      latestAnalysis: analyses.find((a) => a.product_id === p.id) ?? null,
    })),
  };
}

/** 버전 ID들 → 버전과 그 시안의 탭 (AI 분석 결과의 근거 링크). 숨긴 버전도 이름은 보여 준다 */
export async function getVersionsByIds(ids: string[]) {
  const rows = await readRows("submission_versions").catch(missingTableOnly);
  const all = rows ? rows.map((r) => SubmissionVersion.parse(r)) : mock.submissionVersions;
  const submissions = await getSubmissions();
  const wanted = new Set(ids);
  return all.flatMap((version) => {
    const submission = submissions.find((s) => s.id === version.submission_id);
    return wanted.has(version.id) && submission ? [{ version, submission }] : [];
  });
}
