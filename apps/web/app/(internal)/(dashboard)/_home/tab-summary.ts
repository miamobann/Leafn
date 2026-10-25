// 홈 탭별 요약 카드에 넣을 숫자. 각 탭이 쓰는 읽기 함수(lib/data)를 그대로 불러 홈에서 한 줄로 줄인다
import { getAdChecks, getProducts, getReviews, getSurveySummary, getTrendSnapshots } from "@/lib/data";
import type { SkinType } from "@/lib/schemas/survey";

export type TabSummary = {
  tab: string;
  href: string;
  label: string;
  value: string;
  /** 값이 일본어(성분 이름)면 ja */
  lang: "ko" | "ja";
  sub: string;
};

// 응답 집계 화면(survey-results/survey-results-view.tsx)과 같은 이름
const SKIN_KO: Record<SkinType, string> = {
  dry: "건성",
  oily: "지성",
  combo: "복합성",
  inner_dry: "복합성(속건조)",
  normal: "중성",
};
const CONCERN_KO: Record<string, string> = {
  dryness: "건조·당김",
  shine: "번들거림·모공",
  acne: "여드름·트러블",
  dullness: "칙칙함",
  redness: "붉어짐·자극",
  firmness: "탄력·잔주름",
  other: "기타",
};

/** 라쿠텐 랭킹에서 지난 수집보다 언급이 가장 많이 늘어난 성분 (카테고리 전체에서 하나) */
async function marketSummary(): Promise<TabSummary> {
  const base = { tab: "시장 분석", href: "/market", label: "관심 오르는 성분", lang: "ja" as const };
  const snapshots = await getTrendSnapshots({ source: "rakuten_ranking" });
  const byCategory = new Map<string, typeof snapshots>();
  for (const s of snapshots) byCategory.set(s.category, [...(byCategory.get(s.category) ?? []), s]);
  // 스냅샷은 수집 시각 순이라 카테고리마다 마지막 두 개가 직전 수집과 최신 수집이다
  const rising = [...byCategory].flatMap(([category, list]) => {
    const [prev, latest] = list.slice(-2);
    if (!prev || !latest) return [];
    const before = new Map(prev.data.ingredients.map((i) => [i.ingredient, i.count]));
    return latest.data.ingredients.map((i) => ({ category, ingredient: i.ingredient, now: i.count, diff: i.count - (before.get(i.ingredient) ?? 0) }));
  });
  const top = rising.toSorted((a, b) => b.diff - a.diff)[0];
  if (!top || top.diff <= 0) return { ...base, value: "—", lang: "ko", sub: "비교할 랭킹 수집이 아직 없어요" };
  return { ...base, value: top.ingredient, sub: `${top.category} 랭킹 언급 ${top.now - top.diff}→${top.now}` };
}

/** 자사 제품 국내 리뷰 중 AI 분석이 끝난 것의 부정 비율 */
async function reviewSummary(): Promise<TabSummary> {
  const base = { tab: "리뷰 분석", href: "/reviews", label: "자사 리뷰 부정 비율", lang: "ko" as const };
  const [own, reviews] = await Promise.all([getProducts({ kind: "own" }), getReviews({ lang: "ko" })]);
  const ownIds = new Set(own.map((p) => p.id));
  const analyzed = reviews.filter((r) => ownIds.has(r.product_id) && r.analysis);
  if (analyzed.length === 0) return { ...base, value: "—", sub: "분석한 국내 리뷰가 아직 없어요" };
  const negative = analyzed.filter((r) => r.analysis?.sentiment === "negative").length;
  return { ...base, value: `${Math.round((negative / analyzed.length) * 100)}%`, sub: `국내 리뷰 ${analyzed.length}건 중 ${negative}건` };
}

async function adCheckSummary(): Promise<TabSummary> {
  const checks = await getAdChecks();
  const count = (status: string) => checks.filter((c) => c.review_status === status).length;
  return {
    tab: "광고 검토",
    href: "/ad-check/history",
    label: "검토한 문구",
    value: `${checks.length}건`,
    lang: "ko",
    sub: `승인 ${count("approved")} · 대기 ${count("pending")} · 반려 ${count("rejected")}`,
  };
}

async function surveySummary(): Promise<TabSummary> {
  const summary = await getSurveySummary();
  const topType = summary.by_skin_type.toSorted((a, b) => b.count - a.count)[0];
  const concerns = new Map<string, number>();
  for (const row of summary.age_by_concern) for (const [key, n] of Object.entries(row.counts)) concerns.set(key, (concerns.get(key) ?? 0) + n);
  const topConcern = [...concerns].toSorted((a, b) => b[1] - a[1])[0];
  return {
    tab: "소비자 설문",
    href: "/survey-results",
    label: "설문 응답",
    value: `${summary.total}건`,
    lang: "ko",
    sub:
      summary.total === 0
        ? "아직 응답이 없어요"
        : [topType && `${SKIN_KO[topType.skin_type]} 최다`, topConcern && `고민 1위 ${CONCERN_KO[topConcern[0]] ?? topConcern[0]}`].filter(Boolean).join(" · "),
  };
}

export async function getTabSummaries(): Promise<TabSummary[]> {
  return Promise.all([marketSummary(), reviewSummary(), adCheckSummary(), surveySummary()]);
}
