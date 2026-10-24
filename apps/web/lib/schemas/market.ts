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
