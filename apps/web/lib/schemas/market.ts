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

// ── PART 3 기회와 전략 ──────────────────────────────

/** 광고 사용 판정: 사용 가능(사용감·허용 효능) / 근거 자료 필요 / 광고 사용 불가 */
export const ClaimVerdict = z.enum(["usable", "needs_evidence", "not_allowed"]);
export type ClaimVerdict = z.infer<typeof ClaimVerdict>;

/** 키워드 하나의 약기법 판정 (제품 구분별). 근거는 knowledge/yakkiho/의 조항 (AI 판정을 가정한 샘플) */
export const ClaimJudgment = WorkspaceRow.extend({
  /** 통일 이름 (일본어) */
  keyword: z.string(),
  label_ko: z.string(),
  /** 수요 신호·상위권 채택을 찾을 때 대조하는 표기 */
  aliases: z.array(z.string()).min(1),
  general_cosmetic: ClaimVerdict,
  quasi_drug: ClaimVerdict,
  /** 판정 근거 조항 (knowledge/yakkiho/ 파일·항목) */
  basis: z.string(),
  /** 쓰는 방법·주의 (한국어) */
  note_ko: z.string(),
}).extend(AiMeta.shape);
export type ClaimJudgment = z.infer<typeof ClaimJudgment>;

/** 사용 위치 */
export const CopyPlacement = z.enum(["product_name", "detail_page", "qa", "ad"]);
export type CopyPlacement = z.infer<typeof CopyPlacement>;

/** 카피 후보 (AI가 재료로 만든다고 가정한 샘플). 재료는 수요-공급 빈칸·AI 검색 결정 키워드 중 자사 스펙으로 사실인 것만 */
export const CopyCandidate = WorkspaceRow.extend({
  category: z.string(),
  /** 이 카피가 겨냥하는 후보 영역 (lib/market-config.ts) */
  zone_id: z.string(),
  own_product_id: z.string(),
  copy_ja: z.string(),
  copy_ko: z.string(),
  /** 재료 키워드 (ClaimJudgment.keyword) */
  materials: z.array(z.string()).min(1),
  placements: z.array(CopyPlacement).min(1),
  /** 성분을 특기하면 그 성분의 배합 목적 (F5.5). 성분을 안 쓰면 null */
  ingredient_purpose: z.string().nullable(),
  /** 검증 지표와 측정 방법. 목표 수치·표본 수는 지어내지 않는다 */
  verification: z.object({ metric: z.string(), method: z.string() }),
}).extend(AiMeta.shape);
export type CopyCandidate = z.infer<typeof CopyCandidate>;
