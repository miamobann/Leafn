// 경쟁제품 1:1 비교의 계산 (AI 없음, 화면에서 계산하고 저장하지 않는다).
// 정보 비교만 한다: 높낮이(▲▼)는 값의 크고 작음만 뜻하고, 좋다·나쁘다로 해석하지 않는다
import { pricePerMl, readListing, readOwnSpec, type Product } from "@/lib/schemas/product";
import { COMMON_INGREDIENTS, INGREDIENT_MATCH } from "./market";

// ── 주소 ?compare= ─────────────────────

/** 주소의 compare 값 → 제품 ID 목록 (ID마다 encodeURIComponent, 쉼표로 잇는다. 랭킹 제품 ID에 쉼표가 들어갈 수 있어서) */
export function parseCompareParam(search: string): string[] {
  const raw = new URLSearchParams(search).get("compare");
  if (!raw) return [];
  return raw
    .split(",")
    .map((id) => {
      try {
        return decodeURIComponent(id).trim();
      } catch {
        return "";
      }
    })
    .filter(Boolean);
}

export function compareParam(ids: string[]): string {
  return ids.map(encodeURIComponent).join(",");
}

export type ComparePair = {
  own: Product | null;
  competitor: Product | null;
  /** 경쟁 제품만 들어와서 자사 제품을 자동으로 골랐다 */
  autoOwn: boolean;
  /** ID가 3개 이상이었다 (1:1만 지원) */
  tooMany: boolean;
};

/**
 * ID 순서는 무시하고 kind로 칸을 정한다. 없는 ID는 무시한다.
 * 경쟁 제품만 있으면 같은 카테고리의 첫 자사 제품(없으면 첫 자사 제품)을 넣는다
 */
export function resolveComparePair(ids: string[], products: Product[]): ComparePair {
  const found = ids.map((id) => products.find((p) => p.id === id)).filter((p): p is Product => p !== undefined);
  const competitor = found.find((p) => p.kind === "competitor") ?? null;
  let own = found.find((p) => p.kind === "own") ?? null;
  let autoOwn = false;
  if (!own && competitor) {
    const owns = products.filter((p) => p.kind === "own");
    own = owns.find((p) => p.category === competitor.category) ?? owns[0] ?? null;
    autoOwn = own !== null;
  }
  return { own, competitor, autoOwn, tooMany: ids.length > 2 };
}

// ── 높낮이 ─────────────────────

export type Diff = { mark: "▲" | "▼" | "="; text: string };

/** (자사 − 경쟁) ÷ 경쟁. 퍼센트 차이 (예: ▼ 49% 낮음) */
export function percentDiff(own: number | null, comp: number | null): Diff | null {
  if (own == null || comp == null || comp === 0) return null;
  const pct = Math.round(((own - comp) / comp) * 100);
  if (pct === 0) return { mark: "=", text: "= 같음" };
  return pct > 0 ? { mark: "▲", text: `▲ ${pct}% 높음` } : { mark: "▼", text: `▼ ${-pct}% 낮음` };
}

/** 용량 차이 (예: ▲ 50ml 많음) */
export function volumeDiff(own: number | null, comp: number | null): Diff | null {
  if (own == null || comp == null) return null;
  const d = Math.round((own - comp) * 10) / 10;
  if (d === 0) return { mark: "=", text: "= 같음" };
  return d > 0 ? { mark: "▲", text: `▲ ${d}ml 많음` } : { mark: "▼", text: `▼ ${-d}ml 적음` };
}

// ── 가격 ─────────────────────

type CsvImport = { sale_price_jpy?: unknown; coupon_price_jpy?: unknown; row?: Record<string, unknown> };
function csvImport(p: Product): CsvImport | null {
  const v = (p.source_raw as { csv_import?: unknown } | null)?.csv_import;
  return v && typeof v === "object" ? (v as CsvImport) : null;
}

export type SaleInfo = { price: number; label: string; rate: number | null };

/** 행사가: 수집기 값(listing) → CSV·랭킹의 할인가 → 메가와리 쿠폰가 순으로 하나. 평시가보다 쌀 때만 */
export function saleOf(p: Product): SaleInfo | null {
  const regular = p.price_jpy;
  const rate = (price: number) => (regular ? Math.round((1 - price / regular) * 100) : null);
  const l = readListing(p);
  if (l?.sale_price_jpy != null && (regular == null || l.sale_price_jpy < regular)) return { price: l.sale_price_jpy, label: l.sale_label ?? "행사가", rate: rate(l.sale_price_jpy) };
  const csv = csvImport(p);
  if (typeof csv?.coupon_price_jpy === "number") return { price: csv.coupon_price_jpy, label: "メガ割 쿠폰가", rate: rate(csv.coupon_price_jpy) };
  if (typeof csv?.sale_price_jpy === "number") return { price: csv.sale_price_jpy, label: "할인가", rate: rate(csv.sale_price_jpy) };
  return null;
}

/** 배송 조건 (CSV 배송비 열). 없으면 null */
export function shippingOf(p: Product): string | null {
  const v = csvImport(p)?.row?.["배송비"];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** 서로 다른 제품을 묶은 세트인지 (상품명 기준) */
export function isSetProduct(p: Product): boolean {
  return /セット|点|個|種/.test(p.name);
}

/** ml당 가격: 평시가 기준, 행사가 기준 */
export function perMl(p: Product): { regular: number | null; sale: number | null } {
  const sale = saleOf(p);
  return {
    regular: pricePerMl(p),
    sale: sale && p.volume_ml ? Math.round((sale.price / p.volume_ml) * 10) / 10 : null,
  };
}

// ── 성분 ─────────────────────

/** 성분 하나 → 사전 이름 (없으면 null) */
function canonicalOf(ingredient: string): string | null {
  return Object.entries(INGREDIENT_MATCH).find(([, { match }]) => match.some((m) => ingredient.includes(m)))?.[0] ?? null;
}

export type IngredientGroups = {
  common: string[];
  ownOnly: string[];
  competitorOnly: string[];
  /** 사전에 없는 성분 수 (물·BG 같은 흔한 기제는 빼고) */
  unclassified: { own: number; competitor: number };
};

/** 성분 사전으로 이름을 맞춘 뒤 공통 / 자사에만 / 경쟁에만으로 나눈다 */
export function ingredientGroups(own: Product, comp: Product): IngredientGroups {
  const sets = [own, comp].map((p) => {
    const names = new Set<string>();
    let unknown = 0;
    for (const ing of p.ingredients) {
      const c = canonicalOf(ing);
      if (c) names.add(c);
      else if (!COMMON_INGREDIENTS.has(ing)) unknown += 1;
    }
    return { names, unknown };
  });
  const [o, c] = sets;
  return {
    common: [...o.names].filter((n) => c.names.has(n)),
    ownOnly: [...o.names].filter((n) => !c.names.has(n)),
    competitorOnly: [...c.names].filter((n) => !o.names.has(n)),
    unclassified: { own: o.unknown, competitor: c.unknown },
  };
}

export const ingredientKo = (canonical: string) => INGREDIENT_MATCH[canonical]?.ko ?? canonical;

/** 전성분 한국어 (자사: 규격의 한국어 전성분, 경쟁: CSV 국문 번역 열). 없으면 null */
export function fullIngredientsKo(p: Product): string | null {
  const spec = readOwnSpec(p);
  if (spec?.ingredients_ko.length) return spec.ingredients_ko.join(", ");
  const v = csvImport(p)?.row?.["전성분(국문번역)"];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

// ── 문구 ─────────────────────

/** 특징: 경쟁은 features 원문, 자사는 문구 초안(규격의 메인·서브·성분 문구와 사용감) */
export function featureLines(p: Product): string[] {
  const spec = readOwnSpec(p);
  if (p.kind === "own" && spec) return [spec.line_copy.main_ja, spec.line_copy.sub_ja, spec.line_copy.claim_ja, spec.feel_ja].filter(Boolean);
  return p.features;
}

/** 한국어 해석이 이미 있는 문구 (자사 규격의 사용감 등). AI 번역 없이 쓴다 */
export function knownKo(p: Product): Record<string, string> {
  const spec = readOwnSpec(p);
  const map: Record<string, string> = {};
  if (spec) {
    map[spec.feel_ja] = spec.feel_ko;
    map[spec.name_ja] = p.name;
  }
  if (p.title_ai?.name_ko) map[p.name] = p.title_ai.name_ko;
  return map;
}

/** 일본어(가나가 들어 있는 글)인지. 한국어·영어는 해석하지 않는다 */
export function isJapanese(text: string): boolean {
  return /[぀-ヿ]/.test(text);
}
