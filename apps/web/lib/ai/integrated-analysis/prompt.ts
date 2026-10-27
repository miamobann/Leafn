// 통합 AI 분석 프롬프트 조립 (docs/team-approval-ai-analysis.md 10장). 원문은 prompts/integrated-analysis.v<N>.md 에만 있다 (CLAUDE.md 7장).
import { loadPrompt } from "@/lib/ai/prompts";
import type { PromoEventView } from "@/lib/data/launch";
import type { SubmissionTab } from "@/lib/schemas/submission";
import type { SurveySummary } from "@/lib/schemas/survey";
import { CALENDAR_DAYS, MAX_CALENDAR_EVENTS, MIN_REVIEW_SAMPLE } from "./config";

/** #분석 관점의 한 줄 = 결과 섹션 하나. 관점을 더하거나 빼도 화면 코드는 그대로다 */
export type Perspective = { key: string; name: string };

const PERSPECTIVE_LINE = /^-\s*key:\s*([a-z0-9_]+)\s*·\s*이름:\s*(.+?)\s*·\s*설명:/;

/** 본문의 #분석 관점 절에서 관점 목록을 읽는다 */
export function parsePerspectives(body: string): Perspective[] {
  const section = body.split(/^#분석 관점\s*$/m)[1]?.split(/^#/m)[0] ?? "";
  return section.split("\n").flatMap((line) => {
    const m = PERSPECTIVE_LINE.exec(line.trim());
    return m ? [{ key: m[1], name: m[2] }] : [];
  });
}

/**
 * 머리말(--- 앞)은 사람이 읽는 설명이라 빼고 본문만 system 메시지로 쓴다.
 * #분석 관점 · #출력 형식 절이 없거나 관점을 하나도 못 읽으면 호출 전에 오류를 낸다 (리뷰 분석 buildSystemPrompt와 같은 방식)
 */
export async function buildSystemPrompt(version: number): Promise<{ text: string; version: string; perspectives: Perspective[] }> {
  const { text, version: id } = await loadPrompt("integrated-analysis", version);
  const body = text.split(/^---\s*$/m).slice(1).join("---").trim();
  if (!body.includes("#분석 관점") || !body.includes("#출력 형식")) throw new Error(`프롬프트 형식이 맞지 않습니다: ${id}`);
  const perspectives = parsePerspectives(body);
  if (perspectives.length === 0) throw new Error(`프롬프트에서 분석 관점을 읽지 못했습니다: ${id}`);
  return { text: body, version: id, perspectives };
}

export type IntegratedInputVersion = {
  /** 저장할 때 basis를 바꿀 실제 버전 ID */
  id: string;
  /** AI가 근거로 쓰는 이름. 예: review@v2 */
  ref: string;
  tab: SubmissionTab;
  summary: string;
  body: Record<string, unknown>;
  data_as_of: string | null;
};

/** 프롬프트 v4 #입력 형식의 calendar 한 줄. id는 AI에게 보내지 않고, 할 일의 event(key)를 행사로 되돌릴 때만 쓴다 */
export type IntegratedCalendarEvent = {
  key: string;
  id: string;
  title: string;
  platform: string;
  start: string;
  end: string;
  confirmed: boolean;
  milestones: { label: string; due: string; done: boolean }[];
};

/** 프롬프트 v4 #입력 형식의 survey: 설문 집계 화면의 요약을 AI가 읽을 만큼만 줄인 것 (팀장 결재 전 참고 데이터) */
export type IntegratedSurvey = {
  total: number;
  period: { from: string; to: string } | null;
  by_skin_type: Record<string, number>;
  by_age: Record<string, number>;
  concerns: Record<string, number>;
  top_concern_by_age: Record<string, string[]>;
  sensitive_count: number;
  by_source: { source: string; count: number; top_skin_type?: string; clicks?: number }[];
  product_lines: { line_id: string; shown: number; clicks?: number; notify_open?: number }[];
  concern_other: string[];
};

export type IntegratedInput = {
  product: { name: string; skin_line: string | null; sale_status: string | null };
  versions: IntegratedInputVersion[];
  /** 오늘 날짜 (YYYY-MM-DD). 비우면 서울 기준 오늘 */
  today?: string;
  /** 다가오는 프로모션 행사 (v4부터). calendarBrief로 만든다 */
  calendar?: IntegratedCalendarEvent[];
  /** 설문 요약 (v4부터). 응답이 없으면 null */
  survey?: IntegratedSurvey | null;
};

const DAY = 24 * 60 * 60 * 1000;
const addDays = (date: string, days: number) => new Date(Date.parse(date) + days * DAY).toISOString().slice(0, 10);
export const seoulToday = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());

/** 캘린더 행사 중 오늘부터 CALENDAR_DAYS 안에 걸친 것만, 시작일 순으로 key(E1, E2 …)를 붙인다 */
export function calendarBrief(events: PromoEventView[], today: string): IntegratedCalendarEvent[] {
  const until = addDays(today, CALENDAR_DAYS);
  return events
    .filter((e) => e.endDate >= today && e.startDate <= until)
    .toSorted((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, MAX_CALENDAR_EVENTS)
    .map((e, i) => ({
      key: `E${i + 1}`,
      id: e.id,
      title: e.title,
      platform: e.platformName,
      start: e.startDate,
      end: e.endDate,
      confirmed: e.isConfirmed,
      milestones: e.milestones.toSorted((a, b) => a.dueDate.localeCompare(b.dueDate)).map((m) => ({ label: m.label, due: m.dueDate, done: m.done })),
    }));
}

const SURVEY_OTHER_MAX = 5;
const tally = <T>(rows: T[], key: (r: T) => string, count: (r: T) => number) =>
  Object.fromEntries(rows.toSorted((a, b) => count(b) - count(a)).map((r) => [key(r), count(r)]));

/** 설문 집계 요약을 AI 입력으로 줄인다. 응답이 0이면 null (응답 원본 · 개인 단위 행은 보내지 않는다) */
export function surveyBrief(summary: SurveySummary): IntegratedSurvey | null {
  if (summary.total === 0) return null;
  const concerns: Record<string, number> = {};
  for (const row of summary.age_by_concern) for (const [k, n] of Object.entries(row.counts)) concerns[k] = (concerns[k] ?? 0) + n;
  return {
    total: summary.total,
    period: summary.period ?? null,
    by_skin_type: tally(summary.by_skin_type, (r) => r.skin_type, (r) => r.count),
    by_age: tally(summary.by_age ?? [], (r) => r.age_group, (r) => r.count),
    concerns: tally(Object.entries(concerns), ([k]) => k, ([, n]) => n),
    top_concern_by_age: Object.fromEntries(
      summary.age_by_concern.map((row) => {
        const entries = Object.entries(row.counts).filter(([k]) => k !== "other");
        const max = Math.max(0, ...entries.map(([, n]) => n));
        return [row.age_group, entries.filter(([, n]) => n === max && n > 0).map(([k]) => k)];
      }),
    ),
    sensitive_count: summary.sensitive_count,
    by_source: summary.by_source
      .toSorted((a, b) => b.count - a.count)
      .map((s) => ({ source: s.source, count: s.count, ...(s.top_skin_type && { top_skin_type: s.top_skin_type }), ...(s.clicks !== undefined && { clicks: s.clicks }) })),
    product_lines: summary.product_lines.map((l) => ({
      line_id: l.line_id,
      shown: l.shown,
      ...(l.clicks !== undefined && { clicks: l.clicks }),
      ...(l.notify_open !== undefined && { notify_open: l.notify_open }),
    })),
    concern_other: summary.concern_other.flatMap((c) => (c.text_ko.trim() ? [c.text_ko.trim()] : [])).slice(0, SURVEY_OTHER_MAX),
  };
}

/** 근거 리뷰 ID 목록과 상세페이지용 번역 원문은 AI가 쓸 일이 없고 길기만 해서 뺀다 */
const DROP_KEYS = new Set(["evidence_review_ids", "translations"]);

function compact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(compact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !DROP_KEYS.has(key))
        .map(([key, v]) => [key, compact(v)]),
    );
  }
  return value;
}

/** 프롬프트 #입력 형식의 facts. 날짜 차이 · 표본 수 · 미해결 광고 위험은 AI에게 맡기지 않고 코드가 센다 */
export type IntegratedFacts = {
  approved_tabs: SubmissionTab[];
  data_gap_days: number | null;
  review_sample_small: boolean | null;
  ad_unresolved_high: number | null;
  /** v4부터: 마감일 기준 */
  today: string;
  /** v4부터: 설문 응답 수. 설문이 없으면 null */
  survey_total: number | null;
};

export function computeFacts(versions: IntegratedInputVersion[], extra: { today?: string; survey?: IntegratedSurvey | null } = {}): IntegratedFacts {
  const times = versions.flatMap((v) => (v.data_as_of ? [Date.parse(v.data_as_of)] : [])).filter((t) => !Number.isNaN(t));
  const review = versions.find((v) => v.tab === "review");
  const ad = versions.find((v) => v.tab === "ad");
  const analyzed = review?.body.analyzed_count;
  const items = Array.isArray(ad?.body.items) ? (ad.body.items as { overall_risk?: unknown; final_text?: unknown }[]) : [];
  return {
    approved_tabs: [...new Set(versions.map((v) => v.tab))],
    data_gap_days: times.length > 1 ? Math.round((Math.max(...times) - Math.min(...times)) / DAY) : null,
    review_sample_small: review ? typeof analyzed !== "number" || analyzed < MIN_REVIEW_SAMPLE : null,
    ad_unresolved_high: ad ? items.filter((i) => i.overall_risk === "high" && !(typeof i.final_text === "string" && i.final_text.trim())).length : null,
    today: extra.today ?? seoulToday(),
    survey_total: extra.survey?.total ?? null,
  };
}

/** 프롬프트 #입력 형식대로: 제품 한 줄 + facts 한 줄 + 승인본 한 줄씩 + 일정 한 줄씩 + 설문 한 줄 (JSON) */
export function buildUserMessage(input: IntegratedInput, facts: IntegratedFacts = computeFacts(input.versions, input)): string {
  const calendar = input.calendar ?? [];
  return [
    "#입력",
    `product: ${JSON.stringify(input.product)}`,
    `facts: ${JSON.stringify(facts)}`,
    "versions:",
    ...input.versions.map(
      (v) =>
        `- ${JSON.stringify({ ref: v.ref, tab: v.tab, summary: v.summary, data_as_of: v.data_as_of?.slice(0, 10) ?? null, body: compact(v.body) })}`,
    ),
    `calendar:${calendar.length ? "" : " []"}`,
    ...calendar.map(({ key, title, platform, start, end, confirmed, milestones }) => `- ${JSON.stringify({ key, title, platform, start, end, confirmed, milestones })}`),
    `survey: ${input.survey ? JSON.stringify(input.survey) : "null"}`,
    `위 승인본 ${input.versions.length}개${input.survey ? "와 설문(survey@ref, 참고 데이터)" : ""}만 근거로, basis에는 위 ref만 쓰세요.`,
  ].join("\n");
}
