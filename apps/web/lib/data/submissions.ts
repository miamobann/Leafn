// 탭별 시안 · 버전 · 결재 · AI 분석 읽기 (docs/team-approval-ai-analysis.md).
// 연결 환경에서는 현재 팀의 DB를 읽고, 환경 변수가 없는 개발 환경만 샘플(lib/mock/submissions.ts)을 쓴다.
// 테이블이 아직 원격 DB에 적용되지 않았으면 빈 목록이다 (다른 탭과 같은 missingTableOnly).
// 상태 바꾸기(제출 · 결재 · 숨김)는 DB 함수로만 하므로 여기에는 읽기만 둔다.
import { mock } from "@/lib/mock";
import { AiAnalysis } from "@/lib/schemas/ai-analysis";
import {
  MemberTab,
  SubmissionReview,
  SubmissionTab,
  SubmissionVersion,
  TabSubmission,
} from "@/lib/schemas/submission";
import { dataContext, missingTableOnly, readRows } from "./db";
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

/** 시안의 숨기지 않은 버전, 최신 번호부터 */
export async function getSubmissionVersions(submissionId: string): Promise<SubmissionVersion[]> {
  const rows = await readRows("submission_versions").catch(missingTableOnly);
  return (rows ? rows.map((r) => SubmissionVersion.parse(r)) : mock.submissionVersions)
    .filter((v) => v.submission_id === submissionId && !v.deleted_at)
    .toSorted((a, b) => b.version_no - a.version_no);
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
