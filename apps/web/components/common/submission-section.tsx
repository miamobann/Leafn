// 탭 결과 화면에 붙이는 "시안 · 결재" 영역 (서버 컴포넌트, docs/team-approval-ai-analysis.md 7장 2단계).
// 그 제품 × 탭 칸의 시안과 버전 히스토리 · 결재 기록을 읽어 패널에 넘긴다. 판매 중인 자사 제품만 시안 대상이다 (설계 2장).
import { getMembers } from "@/lib/data";
import { getMyTabs, getSubmissionReviews, getSubmissionVersions, getSubmissions } from "@/lib/data/submissions";
import { getCurrentUser, isSupabaseConfigured } from "@/lib/data/workspace";
import type { SaleStatus } from "@/lib/schemas/project";
import { SUBMISSION_TAB_LABELS, type SubmissionTab } from "@/lib/schemas/submission";
import { type SaveDraft, SubmissionPanel, type VersionView } from "./submission-panel";

const TEXT = {
  notOnSale: "판매 중인 자사 제품만 시안을 올릴 수 있어요. 개발 중 제품은 판매를 시작하면 들어와요.",
};

export async function SubmissionSection({
  tab,
  product,
  saveDraft,
  snapshotNote,
  carryOverLabel,
  className,
}: {
  tab: SubmissionTab;
  product: { id: string; kind: "own" | "competitor"; project_id: string | null; sale_status: SaleStatus | null };
  saveDraft: SaveDraft;
  snapshotNote: string;
  carryOverLabel?: string;
  /** 패널 바깥 여백. 기본은 결과 아래에 붙는 mt-6, 오른쪽 열에 둘 때는 덮어쓴다 */
  className?: string;
}) {
  if (product.kind !== "own") return null;
  if (!product.project_id || product.sale_status !== "on_sale") {
    return <p className="mt-6 text-sm text-muted-foreground">{TEXT.notOnSale}</p>;
  }

  const sampleMode = !isSupabaseConfigured();
  const [my, members, me, submissions] = await Promise.all([
    getMyTabs(),
    getMembers(),
    sampleMode ? null : getCurrentUser(),
    getSubmissions({ projectId: product.project_id, productId: product.id, tab }),
  ]);
  const submission = submissions[0] ?? null;
  const versions = submission ? await getSubmissionVersions(submission.id) : [];
  const decisions = versions.length ? await getSubmissionReviews({ versionIds: versions.map((v) => v.id) }) : [];
  const nameOf = (userId: string | null) => members.find((m) => m.user_id === userId)?.display_name ?? "—";

  const views: VersionView[] = versions.map((v) => {
    // 결재 기록은 최근 결재부터라 첫 번째가 그 버전의 결정이다
    const d = decisions.find((r) => r.version_id === v.id);
    return {
      id: v.id,
      version_no: v.version_no,
      status: v.status,
      summary: v.summary,
      note: v.note,
      author_id: v.author_id,
      author_name: nameOf(v.author_id),
      created_at: v.created_at,
      submitted_at: v.submitted_at,
      data_as_of: v.data_as_of,
      decision: d
        ? { decision: d.decision, reason: d.reason, reviewer_name: nameOf(d.reviewer_id), decided_at: d.decided_at, is_self_review: d.is_self_review }
        : null,
    };
  });

  return (
    <SubmissionPanel
      tabLabel={SUBMISSION_TAB_LABELS[tab]}
      status={submission?.status ?? null}
      versions={views}
      canEdit={my.tabs.includes(tab)}
      isOwner={my.role === "owner"}
      meId={me?.id ?? null}
      sampleMode={sampleMode}
      saveDraft={saveDraft}
      snapshotNote={snapshotNote}
      carryOverLabel={carryOverLabel}
      className={className}
    />
  );
}
