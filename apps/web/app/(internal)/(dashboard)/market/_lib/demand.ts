// 시장 분석 원페이지 · PART 2 소비자 트렌드의 계산 (AI 없음). 모든 값은 근거 원문(자동완성 문구·영상 메모)과 함께 돌려준다.
import type { SnsPattern, SnsPatternKind, SnsVideoNote } from "@/lib/schemas/market";
import type { SearchSnap } from "@/lib/schemas/search";
import { AUTOCOMPLETE_SEEDS, classifySuggestion } from "@/lib/external/search-terms";
import { KEYWORD_DICTIONARY } from "@/lib/external/geo-terms";
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
