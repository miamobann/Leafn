// 시장 트렌드 > AI 검색 핵심 포인트(GEO)의 계산 (AI 없음). 여러 답변을 모아 반복해서 나오는 추천 사유·인용 출처·자사 Gap만 센다
import type { Product } from "@/lib/schemas/product";
import type { GeoSnap } from "@/lib/schemas/geo";
import { fold } from "@/lib/ai/appeal-normalize";
import { attributeKeyword, domainType, isIngredientKeyword, KEYWORD_DICTIONARY, sentenceHas, splitSentences } from "@/lib/external/geo-terms";

const pct = (n: number) => Math.round(n * 100);

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
