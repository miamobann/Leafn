// 리뷰 분석 시안에 지금 담겨 있는 소구점 · 후기를 읽는다 (읽기 전용, 서버).
// 소구점 찾기 · 상세페이지용 리뷰 · 요약 탭이 같이 쓴다. 쓰기는 submission-actions의 addToReviewDraft · removeFromReviewDraft.
import type { AppealTopic } from "@/lib/schemas/review";
import { ReviewBody, type VersionStatus } from "@/lib/schemas/submission";
import type { SaleStatus } from "@/lib/schemas/project";
import { getMyTabs, getSubmissions, getSubmissionVersions } from "./submissions";
import { isSupabaseConfigured } from "./workspace";

export type ReviewDraftState = {
  versionId: string;
  versionNo: number;
  status: VersionStatus;
  body: ReviewBody | null;
  topics: AppealTopic[];
  translationIds: string[];
};

/** 이 제품의 리뷰 분석 시안에서 내가 볼 수 있는 가장 최근 버전. 시안이 아직 없으면 null */
export async function getReviewDraftState(productId: string): Promise<ReviewDraftState | null> {
  const [submission] = await getSubmissions({ productId, tab: "review" });
  if (!submission) return null;
  const [latest] = await getSubmissionVersions(submission.id);
  if (!latest) return null;
  const parsed = ReviewBody.safeParse(latest.body);
  const body = parsed.success ? parsed.data : null;
  return {
    versionId: latest.id,
    versionNo: latest.version_no,
    status: latest.status,
    body,
    topics: (body?.appeals ?? []).map((a) => a.topic),
    translationIds: (body?.translations ?? []).map((t) => t.review_translation_id),
  };
}

export type ReviewDraftContext = {
  /** 「시안에 담기」 버튼을 보일 수 있는가 */
  canAdd: boolean;
  /** 못 담을 때 화면에 보일 안내 한 줄 */
  reason: string | null;
  state: ReviewDraftState | null;
};

/** 자사 제품이 시안 대상인지(판매 중 · 프로젝트 소속), 내가 리뷰 분석 담당인지, 지금 무엇이 담겼는지를 한 번에 */
export async function getReviewDraftContext(product: {
  id: string;
  kind: "own" | "competitor";
  project_id: string | null;
  sale_status: SaleStatus | null;
}): Promise<ReviewDraftContext> {
  if (product.kind !== "own") return { canAdd: false, reason: null, state: null };
  if (!isSupabaseConfigured()) return { canAdd: false, reason: "샘플 데이터라 시안에 담을 수 없어요. 로그인한 워크스페이스에서 쓸 수 있어요.", state: null };
  if (!product.project_id || product.sale_status !== "on_sale") {
    return { canAdd: false, reason: "판매 중인 자사 제품만 시안에 담을 수 있어요.", state: null };
  }
  const [my, state] = await Promise.all([getMyTabs(), getReviewDraftState(product.id)]);
  if (!my.tabs.includes("review")) return { canAdd: false, reason: "리뷰 분석 담당이 아니라 보기만 할 수 있어요. 담당 탭은 설정에서 팀장이 정해요.", state };
  return { canAdd: true, reason: null, state };
}
