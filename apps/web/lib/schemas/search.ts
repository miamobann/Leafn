import { z } from "zod";
import { Timestamp, WorkspaceRow } from "./common";

// 검색 자동완성 스냅샷 (B 확장 · 미래 트렌드). 시드 검색어 1개 × 수집 1회 = 1행
export const SuggestionEngine = z.enum(["google_autocomplete"]);
export type SuggestionEngine = z.infer<typeof SuggestionEngine>;

export const SearchSuggestion = z.object({
  value: z.string(),
  /** 자동완성 목록 안의 순서 (1 = 맨 위) */
  position: z.number().int().positive(),
  relevance: z.number().nullable(),
});
export type SearchSuggestion = z.infer<typeof SearchSuggestion>;

export const SearchSnapshot = WorkspaceRow.extend({
  engine: SuggestionEngine,
  seed: z.string(),
  gl: z.string(),
  hl: z.string(),
  captured_at: Timestamp,
  suggestions: z.array(SearchSuggestion),
});
export type SearchSnapshot = z.infer<typeof SearchSnapshot>;

/** 화면·API가 주고받는 모양 (DB 공통 칸 제외) */
export const SearchSnap = SearchSnapshot.omit({ id: true, workspace_id: true, created_at: true });
export type SearchSnap = z.infer<typeof SearchSnap>;

/** POST /api/trends/autocomplete 응답 */
export const AutocompleteRunResult = z.object({
  snapshots: z.array(SearchSnap),
  failures: z.array(z.object({ seed: z.string(), error: z.string() })),
  saved: z.boolean(),
  saveError: z.string().nullable(),
});
export type AutocompleteRunResult = z.infer<typeof AutocompleteRunResult>;
