// GEO 화면의 계산 (AI 없음). 같은 질의를 여러 번 돌린 경우(run_index) 엔진×질의 칸마다 먼저 평균을 내고, 칸들을 다시 평균한다
import type { Product } from "@/lib/schemas/product";
import type { GeoSnap } from "@/lib/schemas/geo";
import { fold } from "@/lib/ai/appeal-normalize";
import { attributeKeyword, domainType, isIngredientKeyword, KEYWORD_DICTIONARY, sentenceHas, splitSentences } from "@/lib/external/geo-terms";

export type GeoCell<T extends GeoSnap = GeoSnap> = { engine: GeoSnap["engine"]; query: string; runs: T[] };

export function geoCells<T extends GeoSnap>(snaps: T[]): GeoCell<T>[] {
  const map = new Map<string, GeoCell<T>>();
  for (const s of snaps) {
    const key = `${s.engine}|${s.query}`;
    const cell: GeoCell<T> = map.get(key) ?? { engine: s.engine, query: s.query, runs: [] };
    cell.runs.push(s);
    map.set(key, cell);
  }
  return [...map.values()];
}

/** 칸 하나에서 브랜드가 언급된 비율 (0~1) */
export function cellMentionRate(cell: GeoCell, brand: string): number {
  return cell.runs.filter((r) => r.brands_mentioned.includes(brand)).length / cell.runs.length;
}

const pct = (n: number) => Math.round(n * 100);
const avg = (xs: number[]) => (xs.length === 0 ? null : Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10);

/** Share of Model: 칸별 언급률의 평균(%) + 언급됐을 때의 평균 순위 */
export function shareOfModel(snaps: GeoSnap[]) {
  const cells = geoCells(snaps);
  const brands = [...new Set(snaps.flatMap((s) => s.brands_mentioned))];
  return brands
    .map((brand) => {
      const ranks = snaps.flatMap((s) => s.brand_mentions.filter((m) => m.brand === brand).map((m) => m.rank));
      const viaLlm = snaps.some((s) => s.brand_mentions.some((m) => m.brand === brand && m.source === "llm"));
      return {
        brand,
        share: cells.length === 0 ? 0 : pct(cells.reduce((sum, c) => sum + cellMentionRate(c, brand), 0) / cells.length),
        avgRank: avg(ranks),
        minRank: ranks.length ? Math.min(...ranks) : null,
        maxRank: ranks.length ? Math.max(...ranks) : null,
        viaLlm,
      };
    })
    .toSorted((a, b) => b.share - a.share || (a.avgRank ?? 99) - (b.avgRank ?? 99));
}

/** 엔진별 자사 Share of Model (%) */
export function engineShare(snaps: GeoSnap[], brand: string) {
  const cells = geoCells(snaps);
  const engines = [...new Set(cells.map((c) => c.engine))];
  return engines.map((engine) => {
    const mine = cells.filter((c) => c.engine === engine);
    return { engine, share: pct(mine.reduce((s, c) => s + cellMentionRate(c, brand), 0) / mine.length), cells: mine.length };
  });
}

/** 인용 도메인 점유: 그 도메인을 인용한 답변 수와 전체 인용 중 비율 */
export function citationShare(snaps: GeoSnap[]) {
  const total = snaps.reduce((s, r) => s + new Set(r.citations.map((c) => c.domain)).size, 0);
  const counts = new Map<string, number>();
  for (const r of snaps) for (const d of new Set(r.citations.map((c) => c.domain))) counts.set(d, (counts.get(d) ?? 0) + 1);
  return [...counts]
    .map(([domain, answers]) => ({ domain, label: domainType(domain).label, answers, share: total === 0 ? 0 : pct(answers / total) }))
    .toSorted((a, b) => b.answers - a.answers);
}

function keywordAliases(keyword: string, matched: string[]): string[] {
  return [...new Set([...(KEYWORD_DICTIONARY[keyword]?.aliases ?? []), ...matched])];
}

/**
 * 결정 키워드: 경쟁 브랜드 / 자사의 추천 사유로 몇 번 나왔는지.
 * 같은 문장에서 키워드 바로 앞(없으면 바로 뒤)에 나온 브랜드의 사유로 센다 (attributeKeyword)
 */
export function keywordStats(snaps: GeoSnap[], ownBrand: string) {
  const byKeyword = new Map<string, { matched: Set<string>; viaLlm: boolean }>();
  for (const s of snaps)
    for (const k of s.keywords) {
      const e = byKeyword.get(k.keyword) ?? { matched: new Set<string>(), viaLlm: false };
      e.matched.add(k.matched_text);
      e.viaLlm ||= k.source === "llm";
      byKeyword.set(k.keyword, e);
    }
  return [...byKeyword]
    .map(([keyword, e]) => {
      const aliases = keywordAliases(keyword, [...e.matched]);
      let competitor = 0;
      let own = 0;
      let answers = 0;
      for (const s of snaps) {
        if (!s.keywords.some((k) => k.keyword === keyword)) continue;
        answers += 1;
        for (const sentence of splitSentences(s.answer)) {
          if (!sentenceHas(sentence, aliases)) continue;
          const brand = attributeKeyword(sentence, aliases, s.brand_mentions);
          if (brand === ownBrand) own += 1;
          else if (brand) competitor += 1;
        }
      }
      return { keyword, ko: KEYWORD_DICTIONARY[keyword]?.ko ?? null, aliases, competitor, own, answers, viaLlm: e.viaLlm, isIngredient: isIngredientKeyword(keyword) };
    })
    .toSorted((a, b) => b.competitor - a.competitor || b.answers - a.answers);
}

/** missing = 자사 제품 정보에 없음, ingredient = 자사 제품에 없는 성분, weak = 제품엔 있으나 AI가 자사와 연결 안 함, linked = 연결됨 */
export type GapStatus = "missing" | "ingredient" | "weak" | "linked";

/** 자사 Gap: 경쟁 추천 문장의 결정 키워드 Top N을 자사 제품 정보·자사 언급 문장과 대조 */
export function keywordGap(snaps: GeoSnap[], ownProducts: Product[], ownBrand: string, top = 5) {
  const ownText = fold(ownProducts.flatMap((p) => [p.name, ...p.features, ...p.ingredients]).join(" "));
  return keywordStats(snaps, ownBrand)
    .filter((k) => k.competitor > 0)
    .slice(0, top)
    .map((k) => {
      const inProduct = k.aliases.some((a) => ownText.includes(fold(a)));
      const status: GapStatus = k.own > 0 ? "linked" : inProduct ? "weak" : k.isIngredient ? "ingredient" : "missing";
      return { ...k, inProduct, status };
    });
}

/** 타겟 매체: 경쟁사는 나오고 자사는 안 나온 답변이 인용한 도메인 */
export function targetMedia(snaps: GeoSnap[], ownBrand: string, top = 5) {
  const counts = new Map<string, { gap: number; own: number }>();
  for (const s of snaps) {
    const hasOwn = s.brands_mentioned.includes(ownBrand);
    const hasComp = s.brands_mentioned.some((b) => b !== ownBrand);
    for (const d of new Set(s.citations.map((c) => c.domain))) {
      const e = counts.get(d) ?? { gap: 0, own: 0 };
      if (hasOwn) e.own += 1;
      else if (hasComp) e.gap += 1;
      counts.set(d, e);
    }
  }
  return [...counts]
    .filter(([, e]) => e.gap > 0)
    .map(([domain, e]) => ({ domain, ...domainType(domain), gapAnswers: e.gap, ownAnswers: e.own }))
    .toSorted((a, b) => b.gapAnswers - a.gapAnswers)
    .slice(0, top);
}

/**
 * 반복 안정성: 2회 이상 돌린 칸에서 자사 언급 여부가 매번 같았는지, 상위 3개 브랜드 구성이 매번 같았는지.
 * 값이 낮으면 답변이 흔들리는 질의라 정밀 모드(3회) 평균을 봐야 한다
 */
export function repeatStability(snaps: GeoSnap[], ownBrand: string) {
  const multi = geoCells(snaps).filter((c) => c.runs.length > 1);
  const sameOwn = multi.filter((c) => new Set(c.runs.map((r) => r.brands_mentioned.includes(ownBrand))).size === 1).length;
  const sameTop3 = multi.filter((c) => new Set(c.runs.map((r) => r.brands_mentioned.slice(0, 3).toSorted().join("|"))).size === 1).length;
  return { cells: multi.length, sameOwn, sameTop3 };
}
