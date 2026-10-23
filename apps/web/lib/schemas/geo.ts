import { z } from "zod";
import { Timestamp, WorkspaceRow } from "./common";
import { SkinConcern } from "./trend";

// (참조 GEO) AI 검색 답변의 브랜드 언급·인용 출처·결정 키워드 (Share of Model)
// 엔진 1회 질의 = 1행. 같은 질의를 여러 번 돌리면 run_index로 구분하고 화면에서 평균을 낸다

export const GeoEngine = z.enum(["chatgpt", "claude", "gemini", "perplexity"]);
export type GeoEngine = z.infer<typeof GeoEngine>;
export const GEO_ENGINE_LABEL: Record<GeoEngine, string> = { chatgpt: "ChatGPT", claude: "Claude", gemini: "Gemini", perplexity: "Perplexity" };

/** dictionary = 사전 대조로 찾음, llm = 사전에 없어 LLM이 뽑고 원문 대조를 통과함 */
export const TermSource = z.enum(["dictionary", "llm"]);

export const GeoBrandMention = z.object({
  brand: z.string(),
  /** 답변에서 처음 나온 순서 (1 = 가장 먼저) */
  rank: z.number().int().positive(),
  /** 답변 원문에 실제로 적힌 표기 */
  matched_text: z.string(),
  source: TermSource,
});

export const GeoCitation = z.object({
  url: z.string().url(),
  domain: z.string(),
  title: z.string().nullable(),
});

export const GeoKeyword = z.object({
  keyword: z.string(),
  matched_text: z.string(),
  source: TermSource,
});

export const GeoSnapshot = WorkspaceRow.extend({
  engine: GeoEngine,
  /** 엔진 안의 실제 모델 (예: gpt-4o-search-preview) */
  model: z.string(),
  /** LLM 보조 추출에 쓴 프롬프트 버전 (사전 대조만 했으면 null) */
  prompt_version: z.string().nullable(),
  /** 질의 카테고리 (化粧水·美容液·…). DB 칸은 null 허용 (나중에 추가한 칸), 앱은 항상 채운다 */
  category: z.string().nullable(),
  query: z.string(),
  /** 질의가 겨냥한 피부 고민 (질의 틀에서 정한다) */
  query_concern: SkinConcern.nullable(),
  run_index: z.number().int().positive(),
  /** 답변 원문 그대로 */
  answer: z.string(),
  /** CLAUDE.md 5장 칸. brand_mentions의 브랜드를 순서대로 (다른 화면이 쓴다) */
  brands_mentioned: z.array(z.string()),
  brand_mentions: z.array(GeoBrandMention),
  /** API가 돌려준 출처 칸에서만 채운다 (답변 글 속 URL은 쓰지 않는다) */
  citations: z.array(GeoCitation),
  keywords: z.array(GeoKeyword),
  captured_at: Timestamp,
});
export type GeoSnapshot = z.infer<typeof GeoSnapshot>;

/** 화면·API가 주고받는 모양 (DB 공통 칸 제외) */
export const GeoSnap = GeoSnapshot.omit({ id: true, workspace_id: true, created_at: true });
export type GeoSnap = z.infer<typeof GeoSnap>;

/** POST /api/geo/run 입력. precise = 정밀 모드 (질의마다 3회 반복) */
export const GeoRunInput = z.object({ category: z.string().min(1), engine: GeoEngine, precise: z.boolean().default(false) });
export type GeoRunInput = z.infer<typeof GeoRunInput>;

export const GeoRunResult = z.object({
  snapshots: z.array(GeoSnap),
  failures: z.array(z.object({ query: z.string(), run_index: z.number().int(), error: z.string() })),
  repeatCount: z.number().int().positive(),
  saved: z.boolean(),
  saveError: z.string().nullable(),
});
export type GeoRunResult = z.infer<typeof GeoRunResult>;

/** LLM 보조 추출 응답 (prompts/geo-extract.v1.md). matched_text는 답변 원문 그대로여야 하고, 서버가 대조한다 */
export const GeoExtraction = z.object({
  brands: z.array(z.object({ name: z.string(), matched_text: z.string() })),
  keywords: z.array(z.object({ keyword: z.string(), matched_text: z.string() })),
});
export type GeoExtraction = z.infer<typeof GeoExtraction>;
