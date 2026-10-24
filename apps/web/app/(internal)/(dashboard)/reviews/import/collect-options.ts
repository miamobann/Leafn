// 플랫폼 수집 화면의 선택지 · 문구 · 선택 기준. 드롭다운 값은 서버로 보내는 수집 요청(StartCollectionInput)과 1:1이다.
import type { CollectionRowView } from "@/lib/data/collection";
import type { StartCollectionInput } from "@/lib/schemas/collection";

export const CATEGORIES = [
  { id: "toner", label: "化粧水 (스킨·토너)" },
  { id: "serum", label: "美容液 (세럼·에센스)" },
] as const;
export const TOP_N_OPTIONS = [10, 20, 30, 50] as const;
/** 가져올 별점 (체크박스). 경쟁 제품의 불만 분석에 쓰는 낮은 별점만 둔다. DB는 1~5점을 담을 수 있다 */
export const STAR_OPTIONS = [1, 2, 3] as const;
export const DEFAULT_STARS: number[] = [3];
/** 별점마다 "새로" 가져올 건수. 이미 저장한 리뷰는 건너뛰고 그다음 최신 리뷰부터 이만큼 모은다 */
export const REVIEW_LIMITS = [
  { value: 20, label: "20건" },
  { value: 50, label: "50건" },
  { value: 100, label: "100건" },
] as const;

/** 체크한 별점의 리뷰가 이보다 적은 제품은 비교하기에 부족하다고 안내하고, 처음에는 선택하지 않는다 */
export const LOW_REVIEW_FLOOR = 10;

/**
 * 수집기가 비교 대상이 아니라고 자동으로 뺀 이유 (sources/qoo10.py classify_listing).
 * not_toner라는 저장 값은 "수집 카테고리의 대상 종류가 아님"이라는 뜻이라, 에센스에서는 "에센스가 아닌 제품"으로 보여 준다.
 * (뺀 제품 목록은 2026-10-24 목업에서 화면에서 뺐다. 다시 보여 줄 때 쓴다)
 */
const TARGET_NAME: Record<string, string> = { toner: "화장수", serum: "에센스" };
export function skipReasonLabel(reason: "set" | "multi_type" | "not_toner", category: string): string {
  if (reason === "set") return "세트·기획 상품";
  if (reason === "multi_type") return "한 목록에서 여러 종류를 함께 파는 상품";
  return `${TARGET_NAME[category] ?? "대상 종류"}가 아닌 제품`;
}

/**
 * 제목에 "옵션으로 고른다 · 시리즈"가 있는 상품. 수집기는 한 종류만 파는 옵션 상품(예: 토너 10종 중 고르기)과
 * 여러 종류가 섞인 상품을 제목만으로 가릴 수 없어서 목록에 남긴다. 화면은 힌트를 붙이고 처음에는 선택하지 않아 사람이 확인하게 한다.
 */
export function looksOptioned(name: string): boolean {
  return /選べる|シリーズ|から選|\d+種/.test(name);
}

/** 화면의 조건 선택. 서버로 보내는 수집 요청(StartCollectionInput)과 1:1이다 */
export type CollectForm = {
  platformId: StartCollectionInput["platformId"];
  categoryId: StartCollectionInput["category"];
  topN: number;
  stars: number[];
  limit: number;
};

/** 처음에는 선택하지 않는 제품인가 (읽지 못함 · 세트 · 불만 리뷰가 거의 없음 · 옵션/시리즈 상품이라 사람이 확인해야 함) */
export function unfit(r: CollectionRowView) {
  return r.failed || r.isSet || looksOptioned(r.name) || (r.lowCount ?? 0) < LOW_REVIEW_FLOOR;
}

/** 이번에 저장할 필요가 있는 제품인가 (새로 저장할 리뷰가 있음) */
export function needsSave(r: CollectionRowView) {
  return !unfit(r) && r.newCount > 0;
}

export const n = (value: number) => value.toLocaleString("en-US");

/** 화면에 보여주는 조건 한 줄 (예: Qoo10 · 化粧水 · 리뷰 많은 순 상위 10개 · 3점 리뷰 · 별점마다 새로 20건) */
export function conditionText(form: CollectForm, platformLabel: string) {
  const category = CATEGORIES.find((c) => c.id === form.categoryId)?.label.split(" ")[0] ?? form.categoryId;
  const stars = form.stars.length > 0 ? `${form.stars.toSorted((a, b) => a - b).join("·")}점 리뷰` : "별점 고르기 전";
  return `${platformLabel} · ${category} · 리뷰 많은 순 상위 ${form.topN}개 · ${stars} · 별점마다 새로 ${form.limit}건`;
}

export const TEXT = {
  noProjects: "우리 제품이 DB에 없어요. 로그인한 워크스페이스에 자사 제품(products, kind = own)을 먼저 넣어 주세요.",
} as const;

export const STEPS = [
  ["찾을 조건 정하기", "어느 플랫폼에서, 어떤 경쟁 제품의 어떤 리뷰를 찾을지 골라요"],
  ["저장할 제품 고르기", "찾은 경쟁 제품 중 리뷰를 저장할 제품에 체크해요"],
  ["저장 끝 · 리포트 보기", "저장한 리뷰로 리포트와 소구점을 확인해요"],
] as const;

export const METHOD: Record<string, string> = {
  qoo10: "Qoo10 구매자 리뷰를 낮은 별점순으로 읽어요. 체험 후기는 없어요. 화장수(化粧水)와 에센스(美容液)를 가져올 수 있어요.",
  rakuten: "라쿠텐 가져오기는 기능 준비 중이에요. 지금은 Qoo10을 골라 주세요.",
};
