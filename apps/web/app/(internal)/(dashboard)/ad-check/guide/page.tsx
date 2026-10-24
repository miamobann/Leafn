import { PageHeader } from "@/components/layout/page-header";
import { getAppealComparison, getSearchSnapshots, getWorkspace } from "@/lib/data";
import { getCurrentUser, getMyWorkspace, getMyWorkspaceMembers } from "@/lib/data/workspace";
import { APPEAL_TOPICS } from "@/lib/schemas/review";
import { ContentGuide, type GuideMaterials } from "../_components/content-guide";
import { GUIDE_DRAFTS } from "../_lib/content-guide-samples";
import { PRODUCTS } from "../_lib/products";
import { AdDisclaimer } from "../_components/ad-disclaimer";

const MAX_KEYWORDS = 5;

/** PDF 머리글의 작성자: 로그인한 사람 이름 · 팀(워크스페이스 이름). 로그인 전에는 샘플 팀 이름만 */
async function getReportAuthor() {
  const user = await getCurrentUser();
  const mine = user ? await getMyWorkspace() : null;
  if (!user || !mine) return { name: "로그인 전", team: (await getWorkspace()).name };
  const me = (await getMyWorkspaceMembers(mine.workspace.id)).find((m) => m.user_id === user.id);
  return { name: me?.display_name ?? user.email ?? "이름 없음", team: mine.workspace.name };
}

export default async function ContentGuidePage() {
  // 반영할 재료 (가짜 데이터, 읽기만): 리뷰 분석의 소구점 · 시장 분석의 검색어 순위
  const [appeals, snapshots, author] = await Promise.all([
    Promise.all(PRODUCTS.map((p) => getAppealComparison(p.id))),
    getSearchSnapshots(),
    getReportAuthor(),
  ]);
  const latest = snapshots.findLast((s) => s.engine === "google_autocomplete");
  const keywords = (latest?.suggestions ?? []).slice(0, MAX_KEYWORDS).map((s) => s.value);
  const materials: GuideMaterials = Object.fromEntries(
    PRODUCTS.map((p, i) => {
      const appeal = appeals[i];
      const praised = (appeal?.topics ?? [])
        .filter((t) => t.praises.length > 0)
        .toSorted((a, b) => b.praiseShare - a.praiseShare)
        .map((t) => APPEAL_TOPICS[t.topic].positive.ko);
      return [p.id, { hasReviews: (appeal?.ownReviewCount ?? 0) > 0, appeals: praised, keywords }];
    }),
  );

  return (
    <>
      <PageHeader
        title="콘텐츠 제작 가이드"
        description="리뷰 소구점과 검색어를 반영해 채널별로 약기법에 맞는 일본어 문구를 추천합니다"
        featureId="A"
      />
      <AdDisclaimer />
      <p className="mt-2 text-xs text-muted-foreground">샘플 데이터 · AI 미연결 · 게시 전에는 새 검토로 다시 확인하세요</p>
      <div className="mt-4">
        <ContentGuide products={PRODUCTS} drafts={GUIDE_DRAFTS} materials={materials} author={author} />
      </div>
    </>
  );
}
