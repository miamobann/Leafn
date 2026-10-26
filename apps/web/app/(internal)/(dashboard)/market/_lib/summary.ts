// 요약 탭: 각 탭의 계산 결과에서 마케터가 바로 쓸 결론 + 할 일만 뽑는다 (AI 없이 정해진 규칙과 문장 틀).
// 요약 탭은 "이번 분석으로 알 수 있는 것"(keyPoints) + "한눈에 보기"(glance)로 보여 준다
// 카드 순서 = 판단 순서: 가격 → 할인·행사 → 경쟁 구도 → 성분 → 소비자 고민 언어 → AI 검색 노출. 데이터가 없는 카드는 만들지 않는다
import type { GeoSnap } from "@/lib/schemas/geo";
import type { SnsTrendResult } from "@/lib/schemas/market";
import type { Product } from "@/lib/schemas/product";
import type { SearchSnap } from "@/lib/schemas/search";
import type { TrendSnapshot } from "@/lib/schemas/trend";
import { matchIngredient } from "@/lib/ai/appeal-normalize";
import { hasIngredient, INGREDIENT_MATCH, ingredientInterestRanking, OWN_BRAND, TOP_N } from "./market";
import { ingredientMentions, ownBaseline, priceMap, rowsAt, top10 } from "./overview";
import { concernSuggestions } from "./demand";
import { keywordGap } from "./geo";

export type MarketTab = "summary" | "action" | "supply" | "demand" | "competitors";

export type KeyPoint = {
  id: string;
  /** 주제 */
  label: string;
  /** 한 줄 결론 */
  headline: string;
  /** 그래서 할 일 (규칙 기반 제안) */
  action: string;
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
  /** 이 카테고리의 마지막 TikTok 분석 결과 (없으면 SNS 줄을 만들지 않는다) */
  sns?: SnsTrendResult | null;
}): KeyPoint[] {
  const { series, products, category, search, geo, geoIsSample, sns } = input;
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
        tab: "supply",
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
        tab: "supply",
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
      tab: "action",
      sample: geoIsSample,
    });
  }

  // 7) SNS 핵심 니즈: TikTok 분석이 끝났을 때만. 가장 많은 영상이 말한 니즈 2개와 그 니즈의 일본어 키워드
  if (sns && sns.needs.length > 0) {
    const [first, second] = sns.needs;
    const keyword = first.keywords[0];
    points.push({
      id: "sns",
      label: "SNS 핵심 니즈",
      headline: `TikTok ${sns.videos.length}개 영상 중 ${first.videos.length}개가 「${first.need_ko}」${second ? ` · 다음은 「${second.need_ko}」(${second.videos.length}개)` : ""}`,
      action: keyword
        ? `숏폼·상세페이지 첫 화면에 「${keyword.keyword_ja}」(${keyword.keyword_ko}) 표현으로 「${first.need_ko}」를 먼저 보여 주기 (효능 표현은 약기법 검토)`
        : `숏폼·상세페이지 첫 화면에 「${first.need_ko}」를 먼저 보여 주기 (효능 표현은 약기법 검토)`,
      tab: "demand",
    });
  }
  return points;
}


// ── 이번 주 핵심 3칸 (2026-10-26): 시장 분석 담당자가 먼저 보는 세 가지 = 우리 가격 위치 · 행사 경쟁 · 소비자가 찾는 것 ─────────────

export type CoreBox = { id: string; label: string; value: string; meaning: string; sub: string | null };

export function weekCore(input: {
  series: TrendSnapshot[];
  products: Product[];
  category: string;
  search: SearchSnap[];
  sns?: SnsTrendResult | null;
}): CoreBox[] {
  const { series, products, category, search, sns } = input;
  const rows = rowsAt(series, series.length - 1);
  const top = top10(rows);
  const boxes: CoreBox[] = [];

  // 1) 우리 가격 위치: 자사 ml당 가격이 순위권 중앙값보다 얼마나 비싼지/싼지 + 할인가 기준으로 필요한 할인
  const list = rows.length > 0 ? priceMap(rows, products, category, "list") : null;
  const sale = rows.length > 0 ? priceMap(rows, products, category, "sale") : null;
  const o = list?.ownCheaperThan[0];
  if (list && o && list.medianPpm !== null) {
    const gap = Math.round((o.ppm / list.medianPpm - 1) * 100);
    const need = sale?.medianPpm != null ? Math.ceil((1 - sale.medianPpm / o.ppm) * 100) : null;
    boxes.push({
      id: "price",
      label: "우리 가격 위치",
      value: gap === 0 ? "중앙값과 같음" : `중앙값보다 ${gap > 0 ? `${gap}% 비쌈` : `${-gap}% 쌈`}`,
      meaning: `${o.name.replace("자사 ", "")} ml당 ${o.ppm}円 · 순위권 중앙값 ${list.medianPpm}円 (정가 기준)`,
      sub: need !== null ? (need > 0 ? `할인가 기준 중앙값(${sale?.medianPpm}円)에 맞추려면 약 ${need}% 할인 필요` : "할인가 기준으로도 중앙값보다 싸요") : null,
    });
  }

  // 2) 행사 경쟁: 상위권 중 행사 쿠폰 수와 쿠폰 할인 폭 (メガ割 대응 판단)
  if (top.length > 0) {
    const coupons = top.filter((r) => r.coupon_price_jpy != null && r.price_jpy > 0);
    const rate = median(coupons.map((r) => Math.round((1 - (r.coupon_price_jpy as number) / r.price_jpy) * 100)));
    const discounted = top.filter((r) => (r.discount_rate ?? 0) > 0).length;
    boxes.push({
      id: "promo",
      label: "행사 경쟁",
      value: coupons.length > 0 ? `상위 ${top.length}개 중 ${coupons.length}개 쿠폰` : `상위 ${top.length}개 중 ${discounted}개 할인`,
      meaning: coupons.length > 0 && rate !== null ? `쿠폰가가 정가보다 ${rate}% 싸요 (중앙값)` : "행사 쿠폰은 거의 없어요",
      sub: coupons.length >= 3 && rate !== null ? `メガ割 참가 시 쿠폰 ${rate}% 전후를 기준으로 준비` : "할인보다 구성·소구로 경쟁할 여지",
    });
  }

  // 3) 소비자가 지금 찾는 것: TikTok 니즈가 있으면 그것, 없으면 성분 검색 관심도 1위 + 고민 검색어
  const interest = ingredientInterestRanking(search, category).rows[0];
  const concern = concernSuggestions(search)
    .groups.map((g) => ({ g, r: g.rows.filter((x) => x.latestPos !== null).toSorted((a, b) => (a.latestPos ?? 99) - (b.latestPos ?? 99))[0] }))
    .filter((x) => x.r)
    .toSorted((a, b) => b.g.rows.length - a.g.rows.length)[0];
  if (sns && sns.needs[0]) {
    boxes.push({
      id: "demand",
      label: "소비자가 찾는 것",
      value: `「${sns.needs[0].need_ko}」`,
      meaning: `TikTok ${sns.videos.length}개 영상 중 ${sns.needs[0].videos.length}개가 언급`,
      sub: interest ? `검색 관심도 1위 성분: ${koOf(interest.canonical ?? interest.term)} ${interest.share}%` : null,
    });
  } else if (interest || concern) {
    boxes.push({
      id: "demand",
      label: "소비자가 찾는 것",
      value: interest ? `${koOf(interest.canonical ?? interest.term)} ${interest.share}%` : `「${concern?.g.seed} ${concern?.r.term}」`,
      meaning: interest ? "성분 검색 관심도 1위 (일본 Google, 최근 3개월)" : "고민 검색 추천어 1위",
      sub: interest && concern ? `고민 검색어: 「${concern.g.seed} ${concern.r.term}」${concern.r.ko ? `(${concern.r.ko})` : ""}` : null,
    });
  }
  return boxes;
}

// ── 한눈에 보기 (요약 탭의 칸들). 칸마다 데이터 모양에 맞는 그래프를 쓴다 ─────────────
// 계산은 각 탭과 같은 함수를 써서 탭을 열면 같은 숫자가 보인다

export type Glance = {
  rankingCount: number;
  /** ml당 가격: 자사 vs 순위권 중앙값 + 순위권 범위 */
  price: { values: number[]; min: number; max: number; median: number; own: { name: string; ppm: number } | null } | null;
  /** 할인·행사 (겹치지 않게 나눈 100% 막대): 쿠폰 / 표시 할인만 / 정가 */
  discount: { total: number; coupon: number; discountOnly: number; plain: number; couponRate: number | null; discountRate: number | null } | null;
  /** 상위권 브랜드 (Top N 칸 그림): 칸마다 브랜드 */
  brands: { cells: string[]; leader: string; leaderCount: number; others: number } | null;
  /** 성분 검색 관심도 (도넛, 합 100%) */
  interest: { slices: { label: string; share: number }[] } | null;
  language: { ko: string; seed: string; term: string; termKo: string | null }[];
};

export function glance(input: { series: TrendSnapshot[]; products: Product[]; category: string; search: SearchSnap[] }): Glance {
  const { series, products, category, search } = input;
  const rows = rowsAt(series, series.length - 1);
  const top = top10(rows);

  const list = rows.length > 0 ? priceMap(rows, products, category, "list") : null;
  const values = list?.points.map((p) => p.ppm) ?? [];
  const o = list?.ownCheaperThan[0];
  const price: Glance["price"] =
    list && values.length > 0 && list.medianPpm !== null
      ? {
          values,
          min: Math.min(...values, o?.ppm ?? Infinity),
          max: Math.max(...values, o?.ppm ?? -Infinity),
          median: list.medianPpm,
          own: o ? { name: o.name.replace("자사 ", ""), ppm: o.ppm } : null,
        }
      : null;

  let discount: Glance["discount"] = null;
  if (rows.length > 0) {
    const coupon = rows.filter((r) => r.coupon_price_jpy != null && r.price_jpy > 0);
    const discountOnly = rows.filter((r) => r.coupon_price_jpy == null && (r.discount_rate ?? 0) > 0);
    discount = {
      total: rows.length,
      coupon: coupon.length,
      discountOnly: discountOnly.length,
      plain: rows.length - coupon.length - discountOnly.length,
      couponRate: median(coupon.map((r) => Math.round((1 - (r.coupon_price_jpy as number) / r.price_jpy) * 100))),
      discountRate: median(rows.filter((r) => (r.discount_rate ?? 0) > 0).map((r) => r.discount_rate as number)),
    };
  }

  let brands: Glance["brands"] = null;
  if (top.length > 0) {
    const counts = new Map<string, number>();
    for (const r of top) counts.set(r.brand, (counts.get(r.brand) ?? 0) + 1);
    const [leader, leaderCount] = [...counts].toSorted((a, b) => b[1] - a[1])[0];
    brands = { cells: top.map((r) => r.brand), leader, leaderCount, others: counts.size - 1 };
  }

  const interestRows = ingredientInterestRanking(search, category).rows;
  const head = interestRows.slice(0, 4).map((r) => ({ label: koOf(r.canonical ?? r.term), share: r.share }));
  const rest = interestRows.slice(4).reduce((sum, r) => sum + r.share, 0);
  const interest: Glance["interest"] = head.length > 0 ? { slices: rest > 0 ? [...head, { label: `기타 ${interestRows.length - 4}개`, share: rest }] : head } : null;

  const language = concernSuggestions(search)
    .groups.map((g) => ({ g, rows: g.rows.filter((r) => r.latestPos !== null) }))
    .filter((x) => x.rows.length > 0)
    .toSorted((a, b) => b.rows.length - a.rows.length)
    .slice(0, 3)
    .map(({ g, rows: r }) => {
      const first = r.toSorted((a, b) => (a.latestPos ?? 99) - (b.latestPos ?? 99))[0];
      return { ko: g.ko, seed: g.seed, term: first.term, termKo: first.ko };
    });

  return {
    rankingCount: rows.length,
    price,
    discount,
    brands,
    interest,
    language,
  };
}
