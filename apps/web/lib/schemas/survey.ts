import { z } from "zod";
import { Timestamp, WorkspaceRow } from "./common";

// (참조 G) 피부타입 설문. 분류 기준은 자체 기준(피지량 × 수분량 2축 참고) — 설계 근거는 "Leaf& 피부타입 설문 설계 정리" 문서
// 점수 키: t = T존 유분, c = 볼 유분, d = 건조, s = 민감
export const ScoreKey = z.enum(["t", "c", "d", "s"]);
export type ScoreKey = z.infer<typeof ScoreKey>;

export const Scores = z.object({ t: z.number().int(), c: z.number().int(), d: z.number().int(), s: z.number().int() });
export type Scores = z.infer<typeof Scores>;

export const SurveyOption = z.object({
  value: z.string(),
  label_ja: z.string(),
  score: Scores.partial().optional(),
  /** 연령 문항에서 18세 미만 선택지 */
  is_under18: z.boolean().optional(),
  /** 복수 선택에서 다른 선택지와 같이 고를 수 없는 "해당 없음" */
  is_none: z.boolean().optional(),
  /** 고르면 자유 입력칸이 나오는 "기타" */
  is_other: z.boolean().optional(),
});
export type SurveyOption = z.infer<typeof SurveyOption>;

export const SurveyQuestion = z.object({
  id: z.string(),
  text_ja: z.string(),
  multi: z.boolean().optional(),
  /** 복수 선택 문항에서 고른 개수만큼 점수를 줄 때 (예: 민감 상황, 최대 2점) */
  count_score: z.object({ key: ScoreKey, max: z.number().int().positive() }).optional(),
  options: z.array(SurveyOption).min(2),
});
export type SurveyQuestion = z.infer<typeof SurveyQuestion>;

/** 결과 유형. 민감 경향은 유형과 별도로 표시한다 */
export const SkinType = z.enum(["dry", "oily", "combo", "inner_dry", "normal"]);
export type SkinType = z.infer<typeof SkinType>;

/** 한 문항의 답: 단일 선택은 value 하나, 복수 선택은 value 목록 */
export const SurveyAnswer = z.union([z.string(), z.array(z.string())]);
export type SurveyAnswer = z.infer<typeof SurveyAnswer>;

/** 유입 경로. 링크의 ?src= 값이거나, 없으면 시작 전에 고른 값 */
export const SurveySource = z.enum(["instagram", "x", "line", "qoo10", "rakuten", "friend", "search", "other"]);
export type SurveySource = z.infer<typeof SurveySource>;

/** surveys 테이블 (supabase/migrations/20261023030815_survey.sql) */
export const Survey = WorkspaceRow.extend({
  public_slug: z.string().regex(/^[a-z0-9-]{2,40}$/),
  title_ja: z.string(),
  questions: z.array(SurveyQuestion),
  is_open: z.boolean(),
});
export type Survey = z.infer<typeof Survey>;

/** survey_responses 테이블. 18세 이상 · 동의한 응답만 저장한다 */
export const SkinSurveyResponse = WorkspaceRow.extend({
  survey_id: z.string(),
  answers: z.record(z.string(), SurveyAnswer),
  age_group: z.enum(["18-19", "20s", "30s", "40s", "50plus"]),
  skin_type: SkinType,
  is_sensitive: z.boolean(),
  score_t_zone_oil: z.number().int().nonnegative(),
  score_cheek_oil: z.number().int().nonnegative(),
  score_dryness: z.number().int().nonnegative(),
  score_sensitivity: z.number().int().nonnegative(),
  concerns: z.array(z.string()),
  concern_other: z.string().max(50).nullable(),
  /** concern_other의 한국어 번역. null = 번역 전 (20261026160000 이전 DB에는 칸이 없다) */
  concern_other_ko: z.string().max(100).nullable().optional(),
  source: SurveySource.nullable(),
  source_other: z.string().max(50).nullable(),
  consent_at: Timestamp,
  consent_version: z.string(),
  locale: z.string(),
});
export type SkinSurveyResponse = z.infer<typeof SkinSurveyResponse>;

/** 문항 화면 → 결과 화면으로 넘기는 브라우저 세션 값 (sessionStorage). 서버에는 보내지 않는다 */
export const SurveySession = z.object({
  answers: z.record(z.string(), SurveyAnswer),
  other_text: z.string().max(50),
  /** 18세 이상이 동의한 시각. 18세 미만은 동의 단계를 건너뛰므로 null */
  consent_at: Timestamp.nullable(),
  consent_version: z.string().nullable(),
  source: SurveySource.nullable(),
  source_other: z.string().max(50),
});
export type SurveySession = z.infer<typeof SurveySession>;

/** 결과 화면 추천 라인 (제품명은 가칭, 문구는 약기법 검토 전) */
export const SurveyProductLine = z.object({
  id: z.string(),
  name_ja: z.string(),
  name_ko: z.string(),
  /** 표 · 카드 제목에 쓰는 짧은 라인 이름 (예: Mild ライン). 없으면 name_ja/name_ko 그대로 */
  short_ja: z.string().optional(),
  short_ko: z.string().optional(),
  /** 짧은 이름 아래 회색으로 적는 제품 이름 (예: Mild Skin · Mild Emulsion) */
  products_label: z.string().optional(),
  ingredients_ja: z.string(),
  status: z.enum(["on_sale", "in_development"]),
  /** public/ 아래 제품 사진 경로. 없으면 자리표시 */
  image_path: z.string().nullable().default(null),
  for_types: z.array(SkinType),
});
export type SurveyProductLine = z.infer<typeof SurveyProductLine>;

/** 대시보드 응답 집계 (가짜 데이터에서는 응답 원본 대신 집계만 둔다) */
export const SurveySummary = z.object({
  total: z.number().int().nonnegative(),
  recent_7d: z.number().int().nonnegative(),
  /** 18세 미만 참여 수. 답 없이 숫자만 기록하며 total에 포함하지 않는다 */
  under18_count: z.number().int().nonnegative(),
  sensitive_count: z.number().int().nonnegative(),
  by_source: z.array(
    z.object({
      source: SurveySource,
      count: z.number().int().nonnegative(),
      /** 이 경로로 온 응답에서 가장 많은 피부타입과 그 수 (채널 성과 표) */
      top_skin_type: SkinType.optional(),
      top_skin_count: z.number().int().nonnegative().optional(),
      /** 이 경로의 구매 클릭 · 출시 예정 화면 열기 횟수. 경로가 기록된 추천 기록이 없으면 비어 있다 */
      clicks: z.number().int().nonnegative().optional(),
      notify: z.number().int().nonnegative().optional(),
    }),
  ),
  /** 응답 기간 (첫 응답일 ~ 마지막 응답일, YYYY-MM-DD) */
  period: z.object({ from: z.string(), to: z.string() }).optional(),
  /** 연령대별 응답 수 */
  by_age: z.array(z.object({ age_group: z.string(), count: z.number().int().nonnegative() })).optional(),
  by_skin_type: z.array(z.object({ skin_type: SkinType, count: z.number().int().nonnegative() })),
  /** 연령대 × 고민 (복수 선택이라 합이 응답 수보다 클 수 있다) */
  age_by_concern: z.array(z.object({ age_group: z.string(), counts: z.record(z.string(), z.number().int().nonnegative()) })),
  concern_other: z.array(z.object({ text_ja: z.string(), text_ko: z.string(), date: z.string() })),
  product_lines: z.array(
    z.object({
      line_id: z.string(),
      shown: z.number().int().nonnegative(),
      clicks: z.number().int().nonnegative().optional(),
      /** 출시 예정 안내 화면을 연 횟수 (notify_open). 신청 수나 사람 수가 아니다 */
      notify_open: z.number().int().nonnegative().optional(),
    }),
  ),
  /** 전체 응답 (최신순). "전체 응답" 탭이 15건씩 나눠 보여 주고 필터한다 */
  responses: z.array(
    z.object({
      at: Timestamp,
      age_group: z.string(),
      skin_type: SkinType,
      is_sensitive: z.boolean(),
      concerns: z.array(z.string()),
      concern_other: z.string().nullable().optional(),
      concern_other_ko: z.string().nullable().optional(),
      source: SurveySource.nullable(),
      consent_version: z.string(),
    }),
  ),
});
export type SurveySummary = z.infer<typeof SurveySummary>;
