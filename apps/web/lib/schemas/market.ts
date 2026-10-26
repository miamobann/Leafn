import { z } from "zod";
import { Id, Timestamp, WorkspaceRow } from "./common";

// 시장 분석 · 소비자 트렌드 2-B SNS 핵심 니즈 (2026-10-24 팀 결정: 새 데이터 소스 도입)
// 2026-10-26: 마케터 메모·공통 패턴 샘플(SnsVideoNote · SnsPattern)을 없애고, 분석 결과를 sns_trend_analyses에 저장한다 (서버 데이터 연동 작업 지침서 2번)

// ── SNS 영상 분석 (POST /api/market/sns-trends) ─────────────
// 2026-10-25: 마케터 메모 대신 영상 링크만 넣으면 Apify가 캡션·해시태그·발화 자막을 가져오고, AI가 핵심 키워드·트렌드를 뽑는다

/** 분석 입력: 영상 링크 (메모는 선택. 있으면 영상 정보와 같이 AI에 넣는다) */
export const SnsTrendInput = z.object({
  category: z.string().min(1),
  videos: z
    .array(z.object({ url: z.string().url("영상 링크가 올바르지 않아요"), memo: z.string().trim().max(2000).default("") }))
    .min(2, "영상을 2개 이상 넣어 주세요")
    .max(10, "영상은 10개까지 넣을 수 있어요"),
});
export type SnsTrendInput = z.infer<typeof SnsTrendInput>;

/** 영상 하나에서 가져온 정보 (Apify TikTok Scraper) */
export const SnsVideoFacts = z.object({
  index: z.number().int().positive(),
  url: z.string(),
  author: z.string(),
  caption: z.string(),
  hashtags: z.array(z.string()),
  /** 영상에서 말한 내용 (TikTok 자동 자막, 일본어). 없으면 null */
  transcript: z.string().nullable(),
  play_count: z.number().nullable(),
  like_count: z.number().nullable(),
  save_count: z.number().nullable(),
  /** TikTok 광고 표시. 없다고 광고가 아니라는 보장은 없다 (ステマ規制) */
  is_ad: z.boolean().nullable(),
  posted_at: z.string().nullable(),
  /** 가져오지 못한 이유 */
  error: z.string().nullable(),
});
export type SnsVideoFacts = z.infer<typeof SnsVideoFacts>;

/** AI 응답 모양 (prompts/sns-trends.v1.md): 소비자 니즈마다 그 니즈를 나타내는 키워드와 근거 문구. 서버가 원문과 대조한다 */
export const SnsTrendAiOutput = z.object({
  needs: z.array(
    z.object({
      need_ko: z.string(),
      summary_ko: z.string(),
      keywords: z.array(z.object({ keyword_ja: z.string(), keyword_ko: z.string() })),
      evidence: z.array(z.object({ video: z.number().int().positive(), quote_ja: z.string() })),
    }),
  ),
});
export type SnsTrendAiOutput = z.infer<typeof SnsTrendAiOutput>;

const SnsNeedKeyword = z.object({ keyword_ja: z.string(), keyword_ko: z.string(), videos: z.array(z.number().int().positive()).min(1) });

/** 분석 결과 (대조를 통과한 것만, 많이 나온 순). 서버가 sns_trend_analyses에 저장하고 화면에 바로 보여 준다 */
export const SnsTrendResult = z.object({
  category: z.string(),
  videos: z.array(SnsVideoFacts),
  /** 핵심 니즈 순위: 언급한 영상 수 → 조회수 합 순. 영상 수는 서버가 원문에서 다시 센다 */
  needs: z.array(
    z.object({
      need_ko: z.string(),
      summary_ko: z.string(),
      keywords: z.array(SnsNeedKeyword).min(1),
      /** 이 니즈의 키워드·근거가 나온 영상 번호 */
      videos: z.array(z.number().int().positive()).min(1),
      views: z.number().nonnegative(),
      evidence: z.array(z.object({ video: z.number().int().positive(), quote_ja: z.string() })),
    }),
  ),
  /** 많이 나온 키워드 순위 (니즈에 묶인 키워드 전체에서) */
  keywords: z.array(SnsNeedKeyword.extend({ need_ko: z.string() })),
  /** 영상 정보에 없어 버린 키워드·근거 수 (할루시네이션 의심) */
  dropped: z.number().int().nonnegative(),
  model: z.string(),
  prompt_version: z.string(),
  analyzed_at: Timestamp,
  /** 저장 결과 (API 응답에만). 테이블 적용 전이면 saved = false */
  saved: z.boolean().optional(),
  save_error: z.string().nullable().optional(),
});
export type SnsTrendResult = z.infer<typeof SnsTrendResult>;

// ── 저장된 분석 (sns_trend_analyses, supabase/migrations/20261026210000_create_sns_trend_analyses.sql) ─────────────

/** videos jsonb 한 칸: 입력 메모 + Apify 영상 정보 */
export const SnsAnalysisVideo = SnsVideoFacts.extend({ memo: z.string().default("") });
export type SnsAnalysisVideo = z.infer<typeof SnsAnalysisVideo>;

/** result jsonb: AI 결과 중 대조를 통과한 것 */
export const SnsAnalysisResult = SnsTrendResult.pick({ needs: true, keywords: true, dropped: true, analyzed_at: true });
export type SnsAnalysisResult = z.infer<typeof SnsAnalysisResult>;

export const SnsTrendAnalysisRow = WorkspaceRow.extend({
  created_by: Id.nullable(),
  category: z.string(),
  videos: z.array(SnsAnalysisVideo),
  result: SnsAnalysisResult,
  model: z.string(),
  prompt_version: z.string(),
});
export type SnsTrendAnalysisRow = z.infer<typeof SnsTrendAnalysisRow>;

/** 저장된 행 → 화면이 그리는 모양 (분석 시각은 결과 안의 analyzed_at) */
export function analysisToResult(row: SnsTrendAnalysisRow): SnsTrendResult {
  return {
    category: row.category,
    // 메모는 결과 화면에 쓰지 않아 뺀다 (videos 칸에는 남아 있다)
    videos: row.videos.map((v) => SnsVideoFacts.parse(v)),
    ...row.result,
    model: row.model,
    prompt_version: row.prompt_version,
    saved: true,
  };
}

/** 결과 JSON 올리기 입력 (PC에서 따로 돌린 분석 결과. 모양은 SnsTrendResult와 같다) */
export const SnsResultUpload = SnsTrendResult.omit({ saved: true, save_error: true });
