// 시장 분석 원페이지 · PART 3 기회와 전략의 계산 (AI 없음).
// 수요 신호(자동완성·SNS·AI 검색)는 있는데 Top 10 상품명·설명에서는 채택이 낮은 키워드를 찾고, 약기법 판정(샘플)을 붙인다.
import type { GeoSnap } from "@/lib/schemas/geo";
import type { ClaimJudgment, ClaimVerdict, CopyCandidate, SnsPattern, SnsVideoNote } from "@/lib/schemas/market";
import type { Product } from "@/lib/schemas/product";
import type { SearchSnap } from "@/lib/schemas/search";
import { fold } from "@/lib/ai/appeal-normalize";
import { splitSentences } from "@/lib/external/geo-terms";
import { GAP_MAX_ADOPTION, POSITIONING, type CandidateZone, type OwnProductClass } from "@/lib/market-config";
import { autocompleteChanges, type AutocompleteStatus } from "./demand";
import { INGREDIENT_MATCH, TOP_N } from "./market";
import type { OverviewRow } from "./overview";

export const VERDICT_LABEL: Record<ClaimVerdict, string> = {
  usable: "✓ 사용 가능",
  needs_evidence: "! 근거 자료 필요",
  not_allowed: "✕ 광고 사용 불가",
};

export type DemandSource = "autocomplete" | "sns" | "geo";
export const DEMAND_SOURCE_LABEL: Record<DemandSource, string> = { autocomplete: "자동완성", sns: "SNS", geo: "AI 검색" };

export type GapRow = {
  judgment: ClaimJudgment;
  sources: DemandSource[];
  /** 자동완성에서 본 추세 (자동완성에 없으면 null) */
  trend: AutocompleteStatus | null;
  /** Top 10 중 상품명·설명·프로모션 문구에 이 키워드가 나온 제품 */
  adopted: OverviewRow[];
  /** 수요 근거 원문 */
  evidence: { source: DemandSource; ja: string; ko?: string; note: string }[];
};

function has(text: string, aliases: string[]): boolean {
  const t = fold(text);
  return aliases.some((a) => t.includes(fold(a)));
}

function rowText(r: OverviewRow): string {
  return [r.name, r.description_ja ?? "", r.promo_text ?? "", ...(r.badges ?? [])].join("\n");
}

/**
 * 수요-공급 빈칸: 판정 사전의 키워드마다 수요 신호와 Top 10 채택 수를 센다.
 * 수요 신호가 하나 이상 있고 채택이 GAP_MAX_ADOPTION 이하인 키워드만 돌려준다
 */
export function demandSupplyGaps(input: {
  category: string;
  top: OverviewRow[];
  search: SearchSnap[];
  snsNotes: SnsVideoNote[];
  snsPatterns: SnsPattern[];
  geo: GeoSnap[];
  judgments: ClaimJudgment[];
}): GapRow[] {
  const auto = autocompleteChanges(input.search, input.category);
  const latestAuto = auto.rows.filter((r) => r.latestPos !== null);
  const notes = input.snsNotes.filter((n) => n.category === input.category);
  const patterns = input.snsPatterns.filter((p) => p.category === input.category);
  const answers = input.geo.filter((g) => g.category === input.category);

  return input.judgments
    .map((j): GapRow => {
      const evidence: GapRow["evidence"] = [];
      const autoRow = latestAuto.find((r) => has(r.term, j.aliases));
      if (autoRow) for (const e of autoRow.evidence.filter((x) => x.date === auto.latest)) evidence.push({ source: "autocomplete", ja: e.value, note: `자동완성 · ${e.date} · ${e.position}번째` });
      for (const p of patterns.filter((x) => x.label_ja && has(x.label_ja, j.aliases))) evidence.push({ source: "sns", ja: `「${p.label_ja}」`, ko: p.label_ko, note: `SNS 공통 표현 · 영상 ${p.video_ids.length}개` });
      for (const n of notes.filter((x) => has(x.note_ja, j.aliases))) evidence.push({ source: "sns", ja: n.note_ja, ko: n.note_ko, note: `SNS 영상 메모 · ${n.title_ja}` });
      for (const a of answers) {
        const sentence = splitSentences(a.answer).find((s) => has(s, j.aliases));
        if (sentence) evidence.push({ source: "geo", ja: sentence, note: `AI 검색 · ${a.engine} · ${a.query}` });
      }
      return {
        judgment: j,
        sources: (["autocomplete", "sns", "geo"] as const).filter((s) => evidence.some((e) => e.source === s)),
        trend: autoRow?.status ?? null,
        adopted: input.top.filter((r) => has(rowText(r), j.aliases)),
        evidence,
      };
    })
    .filter((g) => g.sources.length > 0 && g.adopted.length <= GAP_MAX_ADOPTION)
    .toSorted((a, b) => a.adopted.length - b.adopted.length || b.sources.length - a.sources.length);
}

/** 자사 제품 구분 기준 판정 (구분이 정해지지 않았으면 一般化粧品 기준) */
export function verdictFor(j: ClaimJudgment, ownClass: OwnProductClass): ClaimVerdict {
  return ownClass === "quasi_drug" ? j.quasi_drug : j.general_cosmetic;
}

// ── 3-B 포지셔닝 맵 ───────────────────────────────

export type MapPoint = { id: string; label: string; x: number; y: number; own: boolean; row?: OverviewRow; product?: Product; matched: string };

/** 사용감 표기로 Y값(-1 = 축 왼쪽 끝, +1 = 오른쪽 끝)을 정한다. 양쪽 표기가 다 있거나 없으면 null */
export function axisValue(category: string, text: string): { y: number; matched: string } | null {
  const axis = POSITIONING[category];
  if (!axis) return null;
  const low = axis.low.aliases.find((a) => fold(text).includes(fold(a)));
  const high = axis.high.aliases.find((a) => fold(text).includes(fold(a)));
  if (low && !high) return { y: -1, matched: low };
  if (high && !low) return { y: 1, matched: high };
  return null;
}

export function positioning(category: string, top: OverviewRow[], products: Product[]) {
  const points: MapPoint[] = [];
  const unplaced: OverviewRow[] = [];
  for (const r of top) {
    const v = axisValue(category, rowText(r));
    if (v && r.ppm !== null) points.push({ id: `${r.brand}|${r.name}`, label: `${r.rank}위 ${r.brand}`, x: r.ppm, y: v.y, own: false, row: r, matched: v.matched });
    else unplaced.push(r);
  }
  const own = products.filter((p) => p.kind === "own" && p.category === category);
  const ownUnplaced: Product[] = [];
  for (const p of own) {
    const v = axisValue(category, [p.name, ...p.features].join("\n"));
    if (v && p.price_jpy != null && p.volume_ml) points.push({ id: p.id, label: p.name, x: Math.round((p.price_jpy / p.volume_ml) * 10) / 10, y: v.y, own: true, product: p, matched: v.matched });
    else ownUnplaced.push(p);
  }
  return { axis: POSITIONING[category] ?? null, points, unplaced, ownUnplaced };
}

// ── 3-C 카피 후보 ─────────────────────────────────

/** 카피에 나온 성분 사전 이름 */
export function copyIngredients(copy: string): string[] {
  return Object.entries(INGREDIENT_MATCH)
    .filter(([, { match }]) => match.some((m) => copy.includes(m)))
    .map(([ing]) => ing);
}

/** 자사 스펙 일치: 카피에 나온 성분이 자사 전성분에 있고, 재료 중 광고 사용 불가 판정이 없어야 한다 */
export function specCheck(c: CopyCandidate, own: Product | undefined, judgments: ClaimJudgment[], ownClass: OwnProductClass) {
  const missing = own ? copyIngredients(c.copy_ja).filter((ing) => !own.ingredients.some((x) => INGREDIENT_MATCH[ing].match.some((m) => x.includes(m)))) : [];
  const blocked = c.materials.filter((m) => {
    const j = judgments.find((x) => x.keyword === m);
    return j ? verdictFor(j, ownClass) === "not_allowed" : false;
  });
  return { ok: Boolean(own) && missing.length === 0 && blocked.length === 0, missing, blocked };
}

export function zonesFor(category: string): CandidateZone[] {
  return POSITIONING[category]?.zones ?? [];
}

export { TOP_N };
