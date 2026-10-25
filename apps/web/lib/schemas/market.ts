import { z } from "zod";
import { AiMeta, Timestamp, WorkspaceRow } from "./common";

// 시장 분석 원페이지 · 수요 2-B SNS 공통 패턴 (2026-10-24 팀 결정: 새 데이터 소스 도입)
// 기존 스키마 파일에 맞는 자리가 없는 새 개체라 파일을 따로 둔다. DB 테이블은 아직 만들지 않는다 (mock만)

export const SnsPlatform = z.enum(["tiktok", "youtube", "instagram"]);
export type SnsPlatform = z.infer<typeof SnsPlatform>;
export const SNS_PLATFORM_LABEL: Record<SnsPlatform, string> = { tiktok: "TikTok", youtube: "YouTube", instagram: "Instagram" };

/** 마케터가 등록한 일본 뷰티 영상 1개와 메모 (핵심 발화·댓글) */
export const SnsVideoNote = WorkspaceRow.extend({
  category: z.string(),
  platform: SnsPlatform,
  url: z.string().url(),
  /** 영상 제목 원문 */
  title_ja: z.string(),
  /** 핵심 발화·댓글 메모 원문 */
  note_ja: z.string(),
  note_ko: z.string(),
  /** 영상에 광고 표시(PR·提供 등)가 있었는지. 없다고 비광고 영상이라는 보장은 없다 (ステマ規制) */
  has_ad_label: z.boolean(),
  /** 누가 넣은 값인지 (지금은 마케터 입력만) */
  source: z.enum(["marketer_input"]),
});
export type SnsVideoNote = z.infer<typeof SnsVideoNote>;

/** expression = 소비자 표현, opening = 영상 초반 구성, reason = 유행 이유 */
export const SnsPatternKind = z.enum(["expression", "opening", "reason"]);
export type SnsPatternKind = z.infer<typeof SnsPatternKind>;

/** 여러 영상 메모에서 공통으로 나온 패턴 (AI가 묶는다고 가정한 샘플 결과) */
export const SnsPattern = WorkspaceRow.extend({
  category: z.string(),
  kind: SnsPatternKind,
  /** 소비자 표현은 일본어 원문, 나머지는 null */
  label_ja: z.string().nullable(),
  label_ko: z.string(),
  /** 이 패턴이 나온 영상 (SnsVideoNote.id) */
  video_ids: z.array(z.string()).min(1),
  /** 유행 이유의 근거로 이어지는 화면 (예: 일본 리뷰 불만 비교) */
  related_href: z.string().nullable(),
  analyzed_at: Timestamp,
}).extend(AiMeta.shape);
export type SnsPattern = z.infer<typeof SnsPattern>;

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

/** 분석 결과 (대조를 통과한 것만, 많이 나온 순). 저장하지 않고 화면에 바로 보여준다 */
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
});
export type SnsTrendResult = z.infer<typeof SnsTrendResult>;
