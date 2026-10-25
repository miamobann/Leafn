// 콘텐츠 제작 가이드 화면 재료 (서버 전용): 제품 · 리뷰 소구점 · 검색어 · 메가와리 · PDF 작성자.
// 제작 화면(guide/page.tsx)과 저장된 결과물 화면(guide/history/[guideId])이 같이 쓴다.
import { pickMegaSale, pickReviewQuotes } from "@/lib/ai/content-guide/materials";
import { getAppealComparison, getPromoEvents, getSearchSnapshots, getWorkspace } from "@/lib/data";
import { getAdProducts } from "@/lib/data/ad-products";
import { getToday } from "@/lib/data/launch";
import { getCurrentUser, getMyWorkspace, getMyWorkspaceMembers } from "@/lib/data/workspace";
import { APPEAL_TOPICS } from "@/lib/schemas/review";
import type { GuideMaterials } from "../_components/content-guide";

const MAX_KEYWORDS = 5;

/** PDF 머리글의 작성자: 로그인한 사람 이름 · 팀(워크스페이스 이름). 로그인 전에는 샘플 팀 이름만 */
async function getReportAuthor() {
  const user = await getCurrentUser();
  const mine = user ? await getMyWorkspace() : null;
  if (!user || !mine) return { name: "로그인 전", team: (await getWorkspace()).name };
  const me = (await getMyWorkspaceMembers(mine.workspace.id)).find((m) => m.user_id === user.id);
  return { name: me?.display_name ?? user.email ?? "이름 없음", team: mine.workspace.name };
}

export async function loadGuideContext() {
  const products = (await getAdProducts()).filter((p) => p.price_jpy > 0 && p.volume !== "미등록" && p.line !== "미등록");
  // 반영할 재료 (가짜 데이터, 읽기만): 리뷰 분석의 소구점 · 시장 분석의 검색어 순위
  const [appeals, snapshots, author, events, today] = await Promise.all([
    Promise.all(products.map((p) => getAppealComparison(p.id))),
    getSearchSnapshots(),
    getReportAuthor(),
    getPromoEvents(),
    getToday(),
  ]);
  // 키가 있으면 「제작하기」가 AI를 부른다. 키 값은 화면에 넘기지 않고 있는지만 넘긴다
  const aiEnabled = Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);
  const megaSale = pickMegaSale(events, today);
  const latest = snapshots.findLast((s) => s.engine === "google_autocomplete");
  const keywords = (latest?.suggestions ?? []).slice(0, MAX_KEYWORDS).map((s) => s.value);
  const materials: GuideMaterials = Object.fromEntries(
    products.map((p, i) => {
      const appeal = appeals[i];
      const topics = appeal?.topics ?? [];
      const praised = topics
        .filter((t) => t.praises.length > 0)
        .toSorted((a, b) => b.praiseShare - a.praiseShare)
        .map((t) => APPEAL_TOPICS[t.topic].positive.ko);
      const complaints = topics
        .filter((t) => t.complaints.length > 0)
        .toSorted((a, b) => b.complaintShare - a.complaintShare)
        .map((t) => APPEAL_TOPICS[t.topic].negative.ko);
      const candidates = topics.filter((t) => t.isCandidate).map((t) => APPEAL_TOPICS[t.topic].positive.ko);
      return [p.id, { hasReviews: (appeal?.ownReviewCount ?? 0) > 0, appeals: praised, complaints, candidates, reviewQuotes: pickReviewQuotes(topics), keywords, megaSale }];
    }),
  );
  return { products, materials, author, aiEnabled };
}
