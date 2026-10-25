// 요약 탭: 각 탭의 계산 결과에서 마케터가 바로 쓸 결론 + 할 일만 뽑는다 (AI 없이 정해진 규칙과 문장 틀).
// 카드 순서 = 판단 순서: 가격 → 할인·행사 → 경쟁 구도 → 성분 → 소비자 고민 언어 → AI 검색 노출. 데이터가 없는 카드는 만들지 않는다
import type { GeoSnap } from "@/lib/schemas/geo";
import type { Product } from "@/lib/schemas/product";
import type { SearchSnap } from "@/lib/schemas/search";
import type { TrendSnapshot } from "@/lib/schemas/trend";
import { matchIngredient } from "@/lib/ai/appeal-normalize";
import { hasIngredient, INGREDIENT_MATCH, ingredientInterestRanking, OWN_BRAND, TOP_N } from "./market";
import { ingredientMentions, ownBaseline, priceMap, rowsAt, top10 } from "./overview";
import { concernSuggestions } from "./demand";
import { keywordGap } from "./geo";

export type MarketTab = "summary" | "action" | "market" | "supply" | "demand" | "competitors";

export type KeyPoint = {
  id: string;
  /** 주제 */
  label: string;
  /** 한 줄 결론 */
  headline: string;
  /** 그래서 할 일 (규칙 기반 제안) */
  action: string;
  /** 근거 숫자 */
  detail: string;
  /** 근거가 있는 탭 */
  tab: MarketTab;
  /** 샘플 데이터로 만든 카드 */
  sample?: boolean;
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

const koOf = (ingredient: string) => INGREDIENT_MATCH[ingredient]?.ko ?? ingredient;

export function keyPoints(input: {
  series: TrendSnapshot[];
  products: Product[];
  category: string;
  search: SearchSnap[];
  geo: GeoSnap[];
  geoIsSample: boolean;
}): KeyPoint[] {
  const { series, products, category, search, geo, geoIsSample } = input;
  const rows = rowsAt(series, series.length - 1);
  const top = top10(rows);
  const own = ownBaseline(products, category);
  const points: KeyPoint[] = [];

  // 1) 가격: 정가·할인 후 위치와, 할인 후 중앙값에 맞추려면 몇 % 할인이 필요한지
  if (rows.length > 0) {
    const list = priceMap(rows, products, category, "list");
    const sale = priceMap(rows, products, category, "sale");
    const o = list.ownCheaperThan[0];
    const os = sale.ownCheaperThan[0];
    if (o && os && list.points.length > 0 && sale.medianPpm !== null) {
      const n = list.points.length;
      const before = position(o.cheaper, n);
      const after = position(os.cheaper, n);
      const need = Math.ceil((1 - sale.medianPpm / o.ppm) * 100);
      points.push({
        id: "price",
        label: "가격",
        headline: `${o.name.replace("자사 ", "")} ml당 ${o.ppm}円 — ${before === after ? `순위권에서 ${before}` : `정가로는 ${before}, 할인 적용 후엔 ${after}`}`,
        action: need > 0 ? `할인 후 순위권 중앙값(${sale.medianPpm}円)에 맞추려면 약 ${need}% 이상 할인` : `이미 할인 후 중앙값(${sale.medianPpm}円)보다 싸서 큰 할인 없이도 가격 경쟁 가능`,
        detail: `순위권 ml당 중앙값 정가 ${list.medianPpm}円 → 할인 후 ${sale.medianPpm}円 · 할인 후 우리보다 싼 제품 ${os.cheaper}/${n}`,
        tab: "market",
      });
    }
  }

  // 2) 할인·행사: 표시 할인율과 행사 쿠폰가
  if (rows.length > 0) {
    const discounted = rows.filter((r) => (r.discount_rate ?? 0) > 0);
    const rate = median(discounted.map((r) => r.discount_rate as number));
    const coupons = top.filter((r) => r.coupon_price_jpy != null && r.price_jpy > 0);
    const couponRate = median(coupons.map((r) => Math.round((1 - (r.coupon_price_jpy as number) / r.price_jpy) * 100)));
    if (discounted.length > 0 || coupons.length > 0) {
      points.push({
        id: "discount",
        label: "할인·행사",
        headline:
          coupons.length > 0 && couponRate !== null
            ? `표시 할인은 ${rate ?? 0}% 수준이지만, 상위 ${TOP_N}위 중 ${coupons.length}개가 행사 쿠폰으로 정가보다 ${couponRate}% 싸게 팔림`
            : `순위권 ${discounted.length}/${rows.length}개가 할인 중 (할인율 중앙값 ${rate}%)`,
        action:
          coupons.length >= 3 && couponRate !== null
            ? `メガ割 참가 + 쿠폰 할인 ${couponRate}% 전후 준비`
            : discounted.length >= rows.length / 2 && rate !== null
              ? `상시 할인 ${rate}% 수준 검토`
              : "할인보다 구성·소구로 경쟁",
        detail: `할인 중 ${discounted.length}/${rows.length} · 상위 ${TOP_N}위 중 행사 쿠폰 ${coupons.length}개`,
        tab: "market",
      });
    }
  }

  // 3) 경쟁 구도: 상위권 브랜드 쏠림과 세트 판매
  if (top.length > 0) {
    const byBrand = new Map<string, typeof top>();
    for (const r of top) byBrand.set(r.brand, [...(byBrand.get(r.brand) ?? []), r]);
    const [leader, leaderRows] = [...byBrand].toSorted((a, b) => b[1].length - a[1].length)[0];
    const sets = leaderRows.filter((r) => r.promo_type === "bundle" || /セット/.test(r.name)).length;
    points.push({
      id: "competition",
      label: "경쟁 구도",
      headline:
        leaderRows.length >= 3
          ? `Top ${TOP_N} 중 ${leaderRows.length}개가 ${leader} 한 브랜드${sets >= 2 ? `, 그중 ${sets}개가 세트 상품` : ""}`
          : `Top ${TOP_N} 브랜드가 고르게 퍼져 있음 (최다 ${leader} ${leaderRows.length}개)`,
      action:
        leaderRows.length >= 3 && sets >= 2
          ? "단품만이 아니라 세트 구성 검토"
          : leaderRows.length >= 3
            ? `${leader}의 가격·구성 방식 참고`
            : "특정 브랜드 쏠림이 약해 신규 진입 여지 있음",
      detail: `Top ${TOP_N} 브랜드 ${byBrand.size}개 · K-뷰티 ${top.filter((r) => r.is_kbeauty).length}/${top.length}`,
      tab: "supply",
    });
  }

  // 4) 성분: 검색 관심도와 상위권 상품명, 우리 핵심 성분의 관심도
  const interest = ingredientInterestRanking(search, category);
  const mentions = ingredientMentions(rows);
  if (interest.rows.length > 0 || mentions.length > 0) {
    const first = interest.rows[0];
    const ownIngredients = own ? Object.keys(INGREDIENT_MATCH).filter((ing) => hasIngredient(own, ing)) : [];
    const ownShares = ownIngredients.map((ing) => {
      const row = interest.rows.find((r) => r.canonical === ing);
      const excluded = interest.excluded.some((t) => matchIngredient(t) === ing);
      return { ing, share: row?.share ?? null, excluded };
    });
    const ownBest = Math.max(0, ...ownShares.map((s) => s.share ?? 0));
    const ownText = ownShares
      .map((s) => `${koOf(s.ing)} ${s.share !== null ? `${s.share}%` : s.excluded ? "검색이 너무 적음" : "순위 밖"}`)
      .join(", ");
    points.push({
      id: "ingredient",
      label: "성분",
      headline: [
        first ? `검색 관심도 1위 ${koOf(first.canonical ?? first.term)}(${first.share}%)` : null,
        mentions[0] ? `상위권 상품명엔 ${mentions[0].ko}이 가장 많음` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      action:
        ownShares.length === 0
          ? "우리 제품 전성분을 등록하면 비교할 수 있어요"
          : ownBest < 10
            ? "우리 핵심 성분은 검색 관심이 낮음 → 성분명보다 고민·사용감으로 소구"
            : `「${koOf(ownShares.toSorted((a, b) => (b.share ?? 0) - (a.share ?? 0))[0].ing)}」을 상세페이지 앞쪽에`,
      detail: ownShares.length > 0 ? `우리 핵심 성분: ${ownText}` : `상품명 언급 ${mentions.slice(0, 3).map((m) => `${m.ko} ${m.rows.length}개`).join(", ")}`,
      tab: "demand",
    });
  }

  // 5) 소비자 고민 언어: 고민 단어 뒤에 붙는 검색 추천어 (가장 많이 모인 고민 2개의 1번째 추천어)
  const concern = concernSuggestions(search);
  const picks = concern.groups
    .map((g) => ({ g, rows: g.rows.filter((r) => r.latestPos !== null) }))
    .filter((x) => x.rows.length > 0)
    .toSorted((a, b) => b.rows.length - a.rows.length)
    .slice(0, 2)
    .map(({ g, rows: r }) => ({ g, r: r.toSorted((a, b) => (a.latestPos ?? 99) - (b.latestPos ?? 99))[0] }));
  if (picks.length > 0) {
    points.push({
      id: "language",
      label: "소비자 고민 언어",
      headline: picks.map(({ g, r }) => `${g.ko}: 「${g.seed} ${r.term}」${r.ko ? `(${r.ko})` : ""}`).join(" · "),
      action: "상세페이지·광고 문구에 이 말 그대로 넣기 (효능 표현은 약기법 검토 필요)",
      detail: `구글 검색 추천어 · ${concern.latest} 수집${concern.prev ? ` (지난 수집 ${concern.prev})` : ""}`,
      tab: "demand",
    });
  }

  // 6) AI 검색 노출: AI가 경쟁 제품을 추천할 때 든 이유 중 우리 제품 정보에 없는 말
  const gap = keywordGap(geo.filter((g) => g.category === category), products.filter((p) => p.kind === "own"), OWN_BRAND);
  const missing = gap.filter((k) => k.status === "missing").slice(0, 2);
  const weak = gap.filter((k) => k.status === "weak").slice(0, 2);
  if (missing.length > 0 || weak.length > 0) {
    const quote = (ks: typeof gap) => ks.map((k) => `「${k.keyword}」`).join("");
    points.push({
      id: "geo",
      label: "AI 검색 노출",
      headline:
        missing.length > 0
          ? `AI가 경쟁 제품 추천 이유로 ${quote(missing)}를 많이 듦 · 우리 제품 정보엔 없음`
          : `${quote(weak)}는 우리 제품에도 있지만 AI가 우리와 연결하지 못함`,
      action: missing.length > 0 ? "사실이면 상세페이지·FAQ에 명시" : "일본어 상세페이지·FAQ에 이 표현을 그대로 추가",
      detail: `경쟁 추천 문장 ${[...missing, ...weak].map((k) => `${k.keyword} ${k.competitor}`).join(", ")}`,
      tab: "action",
      sample: geoIsSample,
    });
  }
  return points;
}
