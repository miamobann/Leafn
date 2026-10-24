// 시장 분석 원페이지 · PART 3 기회와 전략의 계산 (AI 없음).
// 수요 신호(자동완성·SNS·AI 검색)는 있는데 Top 10 상품명·설명에서는 채택이 낮은 키워드를 찾고, 약기법 판정(샘플)을 붙인다.
import type { GeoSnap } from "@/lib/schemas/geo";
import type { ClaimJudgment, ClaimVerdict, SnsPattern, SnsVideoNote } from "@/lib/schemas/market";
import type { SearchSnap } from "@/lib/schemas/search";
import { fold } from "@/lib/ai/appeal-normalize";
import { splitSentences } from "@/lib/external/geo-terms";
import { GAP_MAX_ADOPTION } from "@/lib/market-config";
import { autocompleteChanges, type AutocompleteStatus } from "./demand";
import { TOP_N } from "./market";
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

/** 시장 분석이라 특정 제품 구분을 전제하지 않는다: 一般化粧品·医薬部外品 어느 쪽으로도 광고에 쓸 수 없으면 사용 불가 */
export function blockedEverywhere(j: Pick<ClaimJudgment, "general_cosmetic" | "quasi_drug">): boolean {
  return j.general_cosmetic === "not_allowed" && j.quasi_drug === "not_allowed";
}

export { TOP_N };
