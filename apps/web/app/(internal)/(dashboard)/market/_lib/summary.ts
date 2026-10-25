// 이번 주 핵심: 아래 섹션의 계산 결과에서 가격·할인 전략에 바로 쓰는 결론만 뽑는다 (AI 없이 정해진 규칙과 문장 틀).
// 순서 = 판단 순서: 우리 가격은 어디인가 → 실제로 얼마에 팔리나 → 누가 상위권을 어떻게 채우나 → 소비자는 무엇을 찾나
import type { Product } from "@/lib/schemas/product";
import type { SearchSnap } from "@/lib/schemas/search";
import type { TrendSnapshot } from "@/lib/schemas/trend";
import { PROMO_HOOK_LABEL, TOP_N } from "./market";
import { ingredientMentions, priceMap, rowsAt, top10 } from "./overview";
import { autocompleteChanges, AUTOCOMPLETE_STATUS_LABEL } from "./demand";

export type KeyPoint = {
  id: string;
  /** 무엇에 대한 결론인가 */
  label: string;
  /** 한 줄 결론 */
  headline: string;
  /** 결론의 근거 숫자 */
  detail: string;
  /** 근거 섹션 */
  target: "#market" | "#supply" | "#demand";
  go: string;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = values.toSorted((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round(((s[mid - 1] + s[mid]) / 2) * 10) / 10;
}

/** 순위권 안에서의 위치: 자기보다 싼 제품 비율로 말한다 */
function position(cheaper: number, total: number): string {
  const r = total === 0 ? 0 : cheaper / total;
  return r < 0.35 ? "싼 편" : r > 0.65 ? "비싼 편" : "중간";
}

export function keyPoints(input: { series: TrendSnapshot[]; products: Product[]; category: string; search: SearchSnap[] }): KeyPoint[] {
  const { series, products, category, search } = input;
  const rows = rowsAt(series, series.length - 1);
  if (rows.length === 0) return [];
  const points: KeyPoint[] = [];

  // 1) 우리 가격의 위치: 정가 기준과 할인 적용 후를 같이 본다 (자사는 정가 그대로)
  const list = priceMap(rows, products, category, "list");
  const sale = priceMap(rows, products, category, "sale");
  const own = list.ownCheaperThan[0];
  const ownSale = sale.ownCheaperThan[0];
  if (own && ownSale && list.points.length > 0) {
    const n = list.points.length;
    const before = position(own.cheaper, n);
    const after = position(ownSale.cheaper, n);
    points.push({
      id: "price",
      label: "우리 가격의 위치",
      headline:
        before === after
          ? `우리 ${own.name.replace("자사 ", "")}: ml당 가격이 순위권에서 ${before}`
          : `우리 ${own.name.replace("자사 ", "")}: 정가로는 ${before}, 할인 적용 후엔 ${after}`,
      detail: `ml당 ${own.ppm}円 · 순위권 중앙값 정가 ${list.medianPpm}円 → 할인 후 ${sale.medianPpm}円 · 할인 후 우리보다 싼 제품 ${ownSale.cheaper}/${n}`,
      target: "#market",
      go: "시장 개관으로",
    });
  }

  // 2) 실제로 얼마에 팔리나: 표시 할인율과 행사 쿠폰가의 차이
  const discounted = rows.filter((r) => (r.discount_rate ?? 0) > 0);
  const rate = median(discounted.map((r) => r.discount_rate as number));
  const coupons = rows.filter((r) => r.coupon_price_jpy != null && r.price_jpy > 0);
  const couponRate = median(coupons.map((r) => Math.round((1 - (r.coupon_price_jpy as number) / r.price_jpy) * 100)));
  if (discounted.length > 0 || coupons.length > 0) {
    points.push({
      id: "discount",
      label: "실제 판매 가격",
      headline:
        coupons.length > 0 && couponRate !== null
          ? `표시 할인은 ${rate ?? 0}% 수준이지만, 행사 쿠폰을 쓰면 정가보다 ${couponRate}% 싸게 팔림`
          : `순위권 ${discounted.length}/${rows.length}개가 할인 중 (할인율 중앙값 ${rate}%)`,
      detail: `할인 중 ${discounted.length}/${rows.length} · 행사 쿠폰 있는 제품 ${coupons.length}/${rows.length}${coupons.length > 0 ? ` (상위 ${Math.max(...coupons.map((r) => r.rank))}위 안)` : ""}`,
      target: "#market",
      go: "시장 개관으로",
    });
  }

  // 3) 누가 상위권을 어떻게 채우나: 브랜드 쏠림과 판매 방식
  const top = top10(rows);
  const byBrand = new Map<string, number>();
  for (const r of top) byBrand.set(r.brand, (byBrand.get(r.brand) ?? 0) + 1);
  const [leader, leaderCount] = [...byBrand].toSorted((a, b) => b[1] - a[1])[0] ?? ["", 0];
  const promoCounts = new Map<string, number>();
  for (const r of top) if (r.promo_type) promoCounts.set(PROMO_HOOK_LABEL[r.promo_type], (promoCounts.get(PROMO_HOOK_LABEL[r.promo_type]) ?? 0) + 1);
  const [mainPromo, mainPromoCount] = [...promoCounts].toSorted((a, b) => b[1] - a[1])[0] ?? ["", 0];
  points.push({
    id: "top",
    label: "상위권 구성",
    headline:
      leaderCount >= 3
        ? `Top ${TOP_N} 중 ${leaderCount}개가 ${leader} 한 브랜드${mainPromoCount >= 3 ? ` · 판매 방식은 주로 「${mainPromo}」` : ""}`
        : `Top ${TOP_N} 브랜드가 고르게 퍼져 있음 (최다 ${leader} ${leaderCount}개)`,
    detail: `브랜드 ${byBrand.size}개 · ${mainPromo ? `가장 많은 판매 방식 ${mainPromo} ${mainPromoCount}/${top.length} · ` : ""}K-뷰티 ${top.filter((r) => r.is_kbeauty).length}/${top.length}`,
    target: "#supply",
    go: "플랫폼 분석으로",
  });

  // 4) 소비자는 무엇을 찾나: 상위권 상품명에 많이 나온 성분 + 검색 자동완성에 새로 뜬 말
  const mentions = ingredientMentions(rows).slice(0, 3);
  const rising = autocompleteChanges(search, category).rows.find((r) => r.status === "new");
  if (mentions.length > 0 || rising) {
    points.push({
      id: "trend",
      label: "소비자가 찾는 성분",
      headline: mentions.length > 0 ? `상위권 상품명은 ${mentions.map((m) => m.ko).join(" · ")} 중심` : `검색에서 「${rising?.term}」가 뜨는 중`,
      detail: [
        mentions.length > 0 ? `상품명 언급 ${mentions.map((m) => `${m.ko} ${m.rows.length}개`).join(", ")} (순위권 ${rows.length}개 중)` : null,
        // 검색 자동완성은 아직 샘플 데이터 (SerpApi 키를 넣고 수집하면 실데이터)
        rising ? `검색 자동완성(샘플) ${AUTOCOMPLETE_STATUS_LABEL[rising.status]} 「${rising.term}」` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      target: "#demand",
      go: "소비자 트렌드로",
    });
  }
  return points;
}
