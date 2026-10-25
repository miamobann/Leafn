// 시장 분석 원페이지 · PART 2 소비자 트렌드의 계산 (AI 없음). 모든 값은 근거 원문(자동완성 문구·영상 메모)과 함께 돌려준다.
import type { SnsPattern, SnsPatternKind, SnsVideoNote } from "@/lib/schemas/market";
import type { SearchSnap } from "@/lib/schemas/search";
import { CONCERN_SEEDS, classifySuggestion } from "@/lib/external/search-terms";
import { KEYWORD_DICTIONARY } from "@/lib/external/geo-terms";
import { INGREDIENT_MATCH, SKIN_CONCERN_LABEL } from "./market";

// ── 2-A 피부 고민별 검색 추천어 ─────────────────────
// 고민 단어(毛穴·シミ…)를 치면 구글이 띄우는 추천어를 고민별로 모은다. 자동완성은 검색량이 아니라 "보였나"만 본다

export type AutocompleteStatus = "new" | "kept" | "gone";
export const AUTOCOMPLETE_STATUS_LABEL: Record<AutocompleteStatus, string> = {
  new: "새로 나타남",
  kept: "계속 보임",
  gone: "사라짐",
};

export type AutocompleteRow = {
  key: string;
  /** 고민 단어 뒤에 붙은 말 원문 (例: 黒ずみ, 化粧水) */
  term: string;
  /** 한국어 해석 (성분·고민 사전에 있는 말만). 없으면 null */
  ko: string | null;
  status: AutocompleteStatus;
  /** 이번 / 지난 수집 추천어 목록에서의 순서 (안 보였으면 null) */
  latestPos: number | null;
  prevPos: number | null;
  /** 근거: 추천어 원문 */
  evidence: { date: string; value: string; position: number }[];
};

export type ConcernSuggestions = { seed: string; ko: string; rows: AutocompleteRow[] };

/** 추천어에 붙은 말의 한국어 해석: 성분·고민 사전에 있으면 그 이름, 아니면 null */
function koOf(term: string): string | null {
  const t = classifySuggestion(term);
  const parts = [
    ...t.concerns.map((c) => SKIN_CONCERN_LABEL[c]),
    ...t.ingredients.map((i) => INGREDIENT_MATCH[i]?.ko ?? KEYWORD_DICTIONARY[i]?.ko ?? i),
  ];
  return parts.length > 0 ? [...new Set(parts)].join(" · ") : null;
}

/** 일반어(おすすめ·ランキング 등)만으로 된 추천어인지 */
function isGenericOnly(term: string): boolean {
  const t = classifySuggestion(term);
  return t.concerns.length + t.ingredients.length + t.unknown.length === 0;
}

export function concernSuggestions(all: SearchSnap[]) {
  const seeds = new Set<string>(CONCERN_SEEDS.map((s) => s.seed));
  const snaps = all.filter((s) => s.engine === "google_autocomplete" && seeds.has(s.seed));
  const dates = [...new Set(snaps.map((s) => s.captured_at.slice(0, 10)))].toSorted();
  const latest = dates.at(-1) ?? null;
  const prev = dates.at(-2) ?? null;

  const groups: ConcernSuggestions[] = CONCERN_SEEDS.map(({ seed, ko }) => {
    const rows = new Map<string, { term: string; valueKo: string | null; evidence: AutocompleteRow["evidence"]; pos: Map<string, number> }>();
    for (const snap of snaps.filter((x) => x.seed === seed)) {
      const date = snap.captured_at.slice(0, 10);
      if (date !== latest && date !== prev) continue;
      for (const sug of snap.suggestions) {
        const term = sug.value.slice(seed.trim().length).trim();
        if (!term || isGenericOnly(term)) continue;
        const row = rows.get(term) ?? { term, valueKo: null, evidence: [], pos: new Map<string, number>() };
        if (sug.value_ko && (date === latest || !row.valueKo)) row.valueKo = sug.value_ko;
        row.pos.set(date, Math.min(row.pos.get(date) ?? Infinity, sug.position));
        row.evidence.push({ date, value: sug.value, position: sug.position });
        rows.set(term, row);
      }
    }
    const list: AutocompleteRow[] = [...rows.values()].map((r) => {
      const latestPos = latest ? (r.pos.get(latest) ?? null) : null;
      const prevPos = prev ? (r.pos.get(prev) ?? null) : null;
      const status: AutocompleteStatus = latestPos === null ? "gone" : prevPos === null && prev ? "new" : "kept";
      // 한국어 뜻: 수집할 때 번역해 둔 값(추천어 전체 뜻) → 없으면 성분·고민 사전
      return { key: `${seed}|${r.term}`, term: r.term, ko: r.valueKo ?? koOf(r.term), status, latestPos, prevPos, evidence: r.evidence.toSorted((a, b) => b.date.localeCompare(a.date)) };
    });
    const order: Record<AutocompleteStatus, number> = { new: 0, kept: 1, gone: 2 };
    return { seed: seed.trim(), ko, rows: list.toSorted((a, b) => order[a.status] - order[b.status] || (a.latestPos ?? 99) - (b.latestPos ?? 99)) };
  });
  return { latest, prev, groups };
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
