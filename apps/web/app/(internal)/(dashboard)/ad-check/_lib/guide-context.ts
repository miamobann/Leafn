// 콘텐츠 제작 가이드 화면 재료 (서버 전용): 제품 · 리뷰 소구점 · 검색어 · 메가와리 · PDF 작성자.
// 제작 화면(guide/page.tsx)과 저장된 결과물 화면(guide/history/[guideId])이 같이 쓴다.
import { pickMegaSale, pickReviewQuotes, safeComplaintLabel, safePraiseLabels } from "@/lib/ai/content-guide/materials";
import { pickSearchWords, pickTrendIngredients } from "@/lib/ai/content-guide/market";
import { getAppealComparison, getPromoEvents, getSearchSnapshots, getWorkspace } from "@/lib/data";
import { getAdProducts } from "@/lib/data/ad-products";
import { getToday } from "@/lib/data/launch";
import { getCurrentUser, getMyWorkspace, getMyWorkspaceMembers } from "@/lib/data/workspace";
import { APPEAL_TOPICS, type AppealTopic } from "@/lib/schemas/review";
import type { GuideMaterials } from "../_components/content-guide";
import { productKind, skinLineOf } from "./guide-report";

/** PDF 머리글의 작성자: 로그인한 사람 이름 · 팀(워크스페이스 이름). 로그인 전에는 샘플 팀 이름만 */
async function getReportAuthor() {
  const user = await getCurrentUser();
  const mine = user ? await getMyWorkspace() : null;
  if (!user || !mine) return { name: "로그인 전", team: (await getWorkspace()).name };
  const me = (await getMyWorkspaceMembers(mine.workspace.id)).find((m) => m.user_id === user.id);
  return { name: me?.display_name ?? user.email ?? "이름 없음", team: mine.workspace.name };
}

/** 리뷰 분석 「소구점 찾기」에서 고른 소구점 (/ad-check/guide?product=<id>&topics=<키들>). 그 제품에만 적용한다 */
export type PickedTopics = { productId: string; topics: AppealTopic[] };

export async function loadGuideContext(picked?: PickedTopics) {
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
  const materials: GuideMaterials = Object.fromEntries(
    products.map((p, i) => {
      const appeal = appeals[i];
      // 고른 소구점이 있으면 그 주제만 쓴다 (칭찬 소구점 · 후보 · 리뷰 인용 모두). 순함은 아래에서 약기법으로 다시 빠진다
      const pick = picked?.productId === p.id && picked.topics.length > 0 ? picked.topics : null;
      const topics = (appeal?.topics ?? []).filter((t) => !pick || pick.includes(t.topic));
      // 약기법: 순함(저자극)은 빼고, 오래가는 보습(효과 지속)은 사용감 표현으로 바꿔 넘긴다 (materials.ts)
      const praise = safePraiseLabels(
        topics
          .filter((t) => t.praises.length > 0)
          .toSorted((a, b) => b.praiseShare - a.praiseShare)
          .map((t) => ({ key: t.topic, ko: APPEAL_TOPICS[t.topic].positive.ko })),
      );
      const praised = praise.labels;
      const complaints = topics
        .filter((t) => t.complaints.length > 0)
        .toSorted((a, b) => b.complaintShare - a.complaintShare)
        .map((t) => safeComplaintLabel(t.topic, APPEAL_TOPICS[t.topic].negative.ko));
      const candidates = safePraiseLabels(topics.filter((t) => t.isCandidate).map((t) => ({ key: t.topic, ko: APPEAL_TOPICS[t.topic].positive.ko }))).labels;
      // 관심 성분: 시장 분석의 성분 검색 관심도 중 이 제품 전성분에 있는 것만 (약기법: 없는 성분은 쓰지 않는다)
      const own = p.ingredients.map((i) => i.ja);
      const ingredients = pickTrendIngredients(snapshots, productKind(p).ja, own);
      // 검색어·요즘 뜨는 말: 피부 라인에 맞는 고민 자동완성에서 (약기법에 걸리는 말·우리 전성분에 없는 성분이 든 말은 뺀다)
      const words = pickSearchWords(snapshots, skinLineOf(p), own);
      // approvedQuotes: 리뷰 탭의 승인본 읽기 함수(getApprovedReviewQuotes, 해원 PR)가 sub_main에 들어오면 채운다. 승인본은 길이만 거른다 (이미 약기법 검토를 통과)
      return [p.id, { hasReviews: (appeal?.ownReviewCount ?? 0) > 0, appeals: praised, droppedAppeals: praise.dropped, complaints, candidates, reviewQuotes: pickReviewQuotes(topics), approvedQuotes: [], keywords: words.search, trending: words.trending, ingredients, megaSale, pickedTopics: pick?.length ?? null }];
    }),
  );
  return { products, materials, author, aiEnabled };
}
