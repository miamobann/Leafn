// 시장 분석 원페이지 · PART 2 소비자 트렌드의 계산 (AI 없음). 모든 값은 근거 원문(자동완성 문구·영상 메모·AI 답변)과 함께 돌려준다.
import type { GeoEngine, GeoSnap } from "@/lib/schemas/geo";
import type { SnsPattern, SnsPatternKind, SnsVideoNote } from "@/lib/schemas/market";
import type { SearchSnap } from "@/lib/schemas/search";
import { AUTOCOMPLETE_SEEDS, classifySuggestion } from "@/lib/external/search-terms";
import { buildGeoQueries, KEYWORD_DICTIONARY } from "@/lib/external/geo-terms";
import { CATEGORY_KO } from "@/lib/market-config";
import { INGREDIENT_MATCH, SKIN_CONCERN_LABEL } from "./market";

// ── 2-A 검색 자동완성 변화 ────────────────────────
// 자동완성은 검색량이 아니다. "이번 주에 보였나, 몇 번째였나"만 비교한다

export type AutocompleteTab = "concern" | "ingredient" | "other";
export type AutocompleteStatus = "new" | "up" | "same" | "down" | "gone";
export const AUTOCOMPLETE_STATUS_LABEL: Record<AutocompleteStatus, string> = {
  new: "신규 등장",
  up: "순위 상승",
  same: "유지",
  down: "순위 하락",
  gone: "사라짐",
};

export type AutocompleteRow = {
  key: string;
  tab: AutocompleteTab;
  /** 검색어 원문 (시드 뒤에 붙은 말) */
  term: string;
  /** 한국어 해석. 사전에 없는 말은 null */
  ko: string | null;
  status: AutocompleteStatus;
  /** 이번 주 / 지난주 자동완성 목록에서 가장 높은 순서 (안 보였으면 null) */
  latestPos: number | null;
  prevPos: number | null;
  /** 근거: 자동완성 문구 원문 */
  evidence: { date: string; seed: string; value: string; position: number }[];
};

/** 카테고리의 시드 (시드 문구에 카테고리 이름이 들어 있는 것) */
export function seedsFor(category: string): string[] {
  return AUTOCOMPLETE_SEEDS.filter((s) => s.includes(category));
}

export function autocompleteChanges(all: SearchSnap[], category: string) {
  const seeds = new Set(seedsFor(category));
  const snaps = all.filter((s) => s.engine === "google_autocomplete" && seeds.has(s.seed));
  const dates = [...new Set(snaps.map((s) => s.captured_at.slice(0, 10)))].toSorted();
  const latest = dates.at(-1) ?? null;
  const prev = dates.at(-2) ?? null;

  const rows = new Map<string, Omit<AutocompleteRow, "status" | "latestPos" | "prevPos"> & { pos: Map<string, number> }>();
  for (const snap of snaps) {
    const date = snap.captured_at.slice(0, 10);
    if (date !== latest && date !== prev) continue;
    for (const sug of snap.suggestions) {
      const suffix = sug.value.slice(snap.seed.trim().length).trim();
      const terms = classifySuggestion(suffix);
      const found: { key: string; tab: AutocompleteTab; ko: string | null }[] = [
        ...terms.concerns.map((c) => ({ key: `concern:${c}`, tab: "concern" as const, ko: SKIN_CONCERN_LABEL[c] })),
        ...terms.ingredients.map((i) => ({ key: `ingredient:${i}`, tab: "ingredient" as const, ko: INGREDIENT_MATCH[i]?.ko ?? KEYWORD_DICTIONARY[i]?.ko ?? null })),
        ...terms.unknown.map((u) => ({ key: `other:${u}`, tab: "other" as const, ko: null })),
      ];
      for (const f of found) {
        const row = rows.get(f.key) ?? { key: f.key, tab: f.tab, term: suffix, ko: f.ko, evidence: [], pos: new Map<string, number>() };
        if (date === latest) row.term = suffix;
        row.pos.set(date, Math.min(row.pos.get(date) ?? Infinity, sug.position));
        row.evidence.push({ date, seed: snap.seed.trim(), value: sug.value, position: sug.position });
        rows.set(f.key, row);
      }
    }
  }

  const result: AutocompleteRow[] = [...rows.values()].map(({ pos, ...r }) => {
    const latestPos = latest ? (pos.get(latest) ?? null) : null;
    const prevPos = prev ? (pos.get(prev) ?? null) : null;
    const status: AutocompleteStatus =
      latestPos === null ? "gone" : prevPos === null ? "new" : latestPos < prevPos ? "up" : latestPos > prevPos ? "down" : "same";
    return { ...r, latestPos, prevPos, status, evidence: r.evidence.toSorted((a, b) => b.date.localeCompare(a.date) || a.position - b.position) };
  });
  const order: Record<AutocompleteStatus, number> = { new: 0, up: 1, same: 2, down: 3, gone: 4 };
  return {
    latest,
    prev,
    seeds: [...seeds].map((s) => s.trim()),
    rows: result.toSorted((a, b) => order[a.status] - order[b.status] || (a.latestPos ?? 99) - (b.latestPos ?? 99)),
  };
}

// ── 2-B SNS 공통 패턴 ────────────────────────────

export const SNS_PATTERN_KIND_LABEL: Record<SnsPatternKind, string> = {
  expression: "소비자 표현",
  opening: "영상 초반 구성",
  reason: "유행 이유",
};

/** 절반 이상의 영상에서 나온 패턴만 남긴다. videos = 지금 등록된 영상 */
export function commonPatterns(patterns: SnsPattern[], videos: Pick<SnsVideoNote, "id">[], category: string) {
  const ids = new Set(videos.map((v) => v.id));
  const half = Math.ceil(videos.length / 2);
  return patterns
    .filter((p) => p.category === category)
    .map((p) => ({ ...p, hits: p.video_ids.filter((id) => ids.has(id)) }))
    .filter((p) => p.hits.length >= half && p.hits.length > 0)
    .toSorted((a, b) => b.hits.length - a.hits.length);
}

// ── 2-C AI 검색 노출 (GEO) ─────────────────────────

export type GeoCell = {
  runs: GeoSnap[];
  /** 자사가 한 번이라도 언급됐는지 */
  ownMentioned: boolean;
  /** 자사 언급 수 ÷ 전체 브랜드 언급 수 (%). 언급이 없으면 null */
  ownShare: number | null;
  /** 경쟁 브랜드 (언급 많은 순) */
  competitors: string[];
  /** 결정 키워드 (나온 답변 수 많은 순) */
  keywords: { keyword: string; ko: string | null; count: number }[];
  /** 엔진이 준 인용 출처 도메인 (없으면 빈 목록) */
  domains: string[];
};

export function geoMatrix(snaps: GeoSnap[], category: string, ownBrand: string) {
  const list = snaps.filter((s) => s.category === category);
  const queries = [...new Set(list.map((s) => s.query))];
  const engines = [...new Set(list.map((s) => s.engine))] as GeoEngine[];
  const cell = (query: string, engine: GeoEngine): GeoCell | null => {
    const runs = list.filter((s) => s.query === query && s.engine === engine).toSorted((a, b) => a.run_index - b.run_index);
    if (runs.length === 0) return null;
    const mentions = runs.flatMap((r) => r.brand_mentions.map((m) => m.brand));
    const own = mentions.filter((b) => b === ownBrand).length;
    const competitorCounts = new Map<string, number>();
    for (const b of mentions) if (b !== ownBrand) competitorCounts.set(b, (competitorCounts.get(b) ?? 0) + 1);
    const keywordCounts = new Map<string, number>();
    for (const r of runs) for (const k of new Set(r.keywords.map((x) => x.keyword))) keywordCounts.set(k, (keywordCounts.get(k) ?? 0) + 1);
    return {
      runs,
      ownMentioned: own > 0,
      ownShare: mentions.length === 0 ? null : Math.round((own / mentions.length) * 100),
      competitors: [...competitorCounts].toSorted((a, b) => b[1] - a[1]).map(([b]) => b),
      keywords: [...keywordCounts].toSorted((a, b) => b[1] - a[1]).map(([keyword, count]) => ({ keyword, ko: KEYWORD_DICTIONARY[keyword]?.ko ?? null, count })),
      domains: [...new Set(runs.flatMap((r) => r.citations.map((c) => c.domain)))],
    };
  };
  return { queries, engines, cell, measuredAt: list.map((s) => s.captured_at).toSorted().at(-1) ?? null };
}

/** 질의 한국어 해석: 저장된 값 → 질의 틀로 만든 질의면 틀에서 만든 해석 → 없음 */
export function geoQueryKo(s: Pick<GeoSnap, "query" | "query_ko" | "category">): string | null {
  if (s.query_ko) return s.query_ko;
  const tpl = buildGeoQueries(s.category).find((q) => q.query === s.query);
  return tpl ? `${SKIN_CONCERN_LABEL[tpl.concern]} 고민에 추천하는 한국 ${CATEGORY_KO[s.category] ?? s.category}은?` : null;
}

/** 원문에서 표시할 표기 위치를 찾아 조각으로 나눈다 (겹치면 앞의 것을 쓴다) */
export function highlightParts(text: string, marks: string[]): { text: string; mark: boolean }[] {
  const ranges: [number, number][] = [];
  for (const m of [...new Set(marks)].filter(Boolean).toSorted((a, b) => b.length - a.length)) {
    let from = 0;
    for (;;) {
      const i = text.indexOf(m, from);
      if (i < 0) break;
      if (!ranges.some(([s, e]) => i < e && i + m.length > s)) ranges.push([i, i + m.length]);
      from = i + m.length;
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const parts: { text: string; mark: boolean }[] = [];
  let at = 0;
  for (const [s, e] of ranges) {
    if (s > at) parts.push({ text: text.slice(at, s), mark: false });
    parts.push({ text: text.slice(s, e), mark: true });
    at = e;
  }
  if (at < text.length) parts.push({ text: text.slice(at), mark: false });
  return parts;
}
