import type { Lang } from "@/lib/schemas/common";
import type { SaleStatus, SkinLine } from "@/lib/schemas/project";
import type { Review, ReviewAnalysis, ReviewInsight } from "@/lib/schemas/review";
import { getProduct, getProducts, getReviewReport, getReviews } from "./index";

export type ReviewProductView = {
  id: string;
  brand: string;
  name: string;
  kind: "own" | "competitor";
  ko: number;
  ja: number;
  /** 化粧水 · 美容液처럼 랭킹 카테고리 이름. 모르면 null */
  category: string | null;
  platform: string;
  /** 경쟁 제품의 랭킹 순위 (source_raw.qoo10_rank). 모르면 null */
  rank: number | null;
  /** 자사 제품의 피부 라인 · 판매 상태. 경쟁 제품은 null */
  skinLine: SkinLine | null;
  saleStatus: SaleStatus | null;
};
export type ReviewWithAnalysis = Review & { analysis: ReviewAnalysis | null };
export type ReviewReportView = {
  reviews: ReviewWithAnalysis[];
  insights: ReviewInsight[];
  sentiment: { positive: number; negative: number; neutral: number };
  /** AI 분석 결과가 하나라도 있는가. 없으면 감성 · 키워드 · 불만 유형 칸은 비어 있다 */
  analyzed: boolean;
};

function rankOf(sourceRaw: unknown): number | null {
  const rank = (sourceRaw as Record<string, unknown> | null)?.qoo10_rank;
  return typeof rank === "number" ? rank : null;
}

/** 리포트 목록: 우리 제품과 저장한 경쟁 제품, 언어별 리뷰 수 */
export async function getReviewProductList(): Promise<ReviewProductView[]> {
  const [products, reviews] = await Promise.all([getProducts(), getReviews()]);
  const counts = new Map<string, { ko: number; ja: number }>();
  for (const review of reviews) {
    const count = counts.get(review.product_id) ?? { ko: 0, ja: 0 };
    count[review.lang]++;
    counts.set(review.product_id, count);
  }
  return products
    .map((p) => ({
      id: p.id,
      brand: p.brand,
      name: p.name,
      kind: p.kind,
      ...(counts.get(p.id) ?? { ko: 0, ja: 0 }),
      category: p.category ?? null,
      platform: p.platform,
      rank: rankOf(p.source_raw),
      skinLine: p.skin_line,
      saleStatus: p.sale_status,
    }))
    .toSorted((a, b) => Number(b.kind === "own") - Number(a.kind === "own"));
}

export async function getReviewProductById(id: string) {
  return getProduct(id);
}

export async function getReviewsOf(productId: string, opts: { lang?: Lang } = {}): Promise<ReviewWithAnalysis[]> {
  return (await getReviews({ productId, ...opts })).sort(
    (a, b) => a.rating - b.rating || b.posted_at.localeCompare(a.posted_at) || a.id.localeCompare(b.id),
  );
}

export async function getReviewReportOf(productId: string): Promise<ReviewReportView> {
  const report = await getReviewReport(productId);
  return { ...report, analyzed: report.reviews.some((r) => r.analysis !== null) };
}
