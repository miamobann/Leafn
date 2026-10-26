// 홈 프로젝트 진행 현황 읽기 (서버 데이터 연동 작업 지침서 4번 A안, 2026-10-26 총괄 결정). 새 테이블 없이 있는 데이터로 계산한다.
// 줄 = 프로젝트의 판매 중 자사 제품, 칸 = 시장 분석 · 리뷰 분석 · 광고 검토 · AI 분석.
// 칸마다 시안 상태(getProgressGrid, /projects 진행 표와 같은 데이터)와 데이터 준비 숫자를 준다. 샘플 모드는 mock으로 같은 표를 만든다
import { reviewProductRank } from "./appeal";
import { readRows } from "./db";
import { getAdChecks, getProducts, getPromoEvents, getReviews, getTrendSnapshots } from "./index";
import { getToday } from "./launch";
import { getApprovalInbox, getProgressGrid, STALE_REVIEW_DAYS } from "./submissions";

/** 칸별 데이터 준비: 시안을 만들기 전에 그 탭의 재료가 얼마나 모였는지 */
export type HomeReadiness = {
  /** 연결된 경쟁 제품 수와 같은 카테고리의 마지막 Qoo10 랭킹 수집일 */
  market: { competitors: number; rankingDate: string | null };
  /** 리뷰 수(제외한 리뷰는 빼고)와 그중 AI 분석을 마친 수 */
  review: { reviews: number; analyzed: number };
  /** 이 제품 광고 문구 검토의 승인 · 대기 수 */
  ad: { approved: number; pending: number };
  /** 최신 AI 분석 실행일과 팀장 확인 여부 */
  ai: { date: string | null; checked: boolean };
};

export type HomeProgress = Awaited<ReturnType<typeof getHomeProgress>>;

// 샘플 모드는 경쟁 연결이 없어서 소구점 찾기와 같은 기준(같은 카테고리 Qoo10 랭킹 TOP10)으로 센다 (index.ts getAppealComparison)
const SAMPLE_COMPETITORS = 10;

export async function getHomeProgress(projectIds: string[]) {
  const [grids, products, links, rankings, reviews, adChecks, events, inbox, today] = await Promise.all([
    Promise.all(projectIds.map(async (id) => [id, await getProgressGrid(id)] as const)),
    getProducts(),
    readRows("product_competitors"),
    getTrendSnapshots({ source: "qoo10_ranking" }),
    getReviews(),
    getAdChecks(),
    getPromoEvents(),
    getApprovalInbox({ recentLimit: 0 }),
    getToday(),
  ]);

  const readiness = Object.fromEntries(
    grids.flatMap(([, grid]) => grid.rows).map((row) => {
      const own = products.find((p) => p.id === row.productId);
      const competitors = links
        ? new Set(links.filter((l) => l.own_product_id === row.productId).map((l) => l.competitor_product_id)).size
        : Math.min(
            SAMPLE_COMPETITORS,
            products.filter((p) => p.kind === "competitor" && p.platform === "qoo10" && p.category === own?.category && reviewProductRank(p.source_raw) !== null).length,
          );
      const mine = reviews.filter((r) => r.product_id === row.productId);
      const checks = adChecks.filter((a) => a.product_id === row.productId);
      const analysis = row.latestAnalysis;
      const value: HomeReadiness = {
        // 랭킹은 수집 시각 오름차순이라 마지막이 최신
        market: { competitors, rankingDate: rankings.findLast((t) => t.category === own?.category)?.captured_at.slice(0, 10) ?? null },
        review: { reviews: mine.length, analyzed: mine.filter((r) => r.analysis).length },
        ad: { approved: checks.filter((c) => c.review_status === "approved").length, pending: checks.filter((c) => c.review_status === "pending").length },
        ai: { date: analysis?.created_at.slice(0, 10) ?? null, checked: Boolean(analysis?.lead_checked_at) },
      };
      return [row.productId, value] as const;
    }),
  );

  // 행사는 시작일 오름차순이라 오늘 이후 첫 행사가 다음 행사
  const next = events.find((e) => e.start_date >= today);
  return {
    today,
    /** 프로젝트 ID → 진행 표 */
    grids: Object.fromEntries(grids),
    /** 제품 ID → 칸별 데이터 준비 */
    readiness,
    /** 결재 대기 중인 시안 ID → 기다린 날 수 */
    waiting: Object.fromEntries(inbox.pending.map((r) => [r.submission.id, r.waitingDays])),
    /** STALE_REVIEW_DAYS일 넘게 결재를 기다리는 버전 수 */
    staleReviews: inbox.pending.filter((r) => r.waitingDays > STALE_REVIEW_DAYS).length,
    nextEvent: next ? { id: next.id, title: next.title, startDate: next.start_date } : null,
  };
}
