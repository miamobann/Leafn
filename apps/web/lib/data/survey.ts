import { z } from "zod";
import { mock } from "@/lib/mock";
import { SkinSurveyResponse, SurveySummary, Survey } from "@/lib/schemas/survey";
import { readRows } from "./db";

const Minor = z.object({ count: z.number().int().nonnegative() });
const Event = z.object({
  product_line: z.string(),
  event: z.enum(["shown", "buy_click", "notify_open"]),
  // 20261026170000 마이그레이션 이전 DB에는 칸이 없다
  source: z.string().nullable().optional(),
});

export async function readSurveySummary() {
  const rows = await readRows("survey_responses");
  if (!rows) return mock.surveySummary;
  const responses = SkinSurveyResponse.array().parse(rows);
  const [minorRows, eventRows] = await Promise.all([readRows("survey_minor_counts"), readRows("survey_reco_events")]);
  const minors = Minor.array().parse(minorRows);
  const events = Event.array().parse(eventRows);
  const counts = (key: (r: SkinSurveyResponse) => string) => {
    const result = new Map<string, number>();
    for (const row of responses) result.set(key(row), (result.get(key(row)) ?? 0) + 1);
    return [...result];
  };
  const dates = responses.map((r) => r.created_at).sort();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const hasSource = events.some((e) => e.source);
  return SurveySummary.parse({
    total: responses.length,
    recent_7d: responses.filter((r) => r.created_at >= weekAgo).length,
    under18_count: minors.reduce((sum, r) => sum + r.count, 0),
    sensitive_count: responses.filter((r) => r.is_sensitive).length,
    // 채널별 구매 클릭 · 출시 예정 화면 열기 횟수는 경로가 기록된 추천 이벤트로 센다.
    by_source: counts((r) => r.source ?? "other").map(([source, count]) => {
      const types = new Map<string, number>();
      for (const r of responses) if ((r.source ?? "other") === source) types.set(r.skin_type, (types.get(r.skin_type) ?? 0) + 1);
      const [top_skin_type, top_skin_count] = [...types].sort((a, b) => b[1] - a[1])[0];
      if (!hasSource) return { source, count, top_skin_type, top_skin_count };
      const of = (event: string) => events.filter((e) => e.source === source && e.event === event).length;
      return { source, count, top_skin_type, top_skin_count, clicks: of("buy_click"), notify: of("notify_open") };
    }),
    period: dates.length ? { from: dates[0].slice(0, 10), to: dates[dates.length - 1].slice(0, 10) } : undefined,
    by_age: counts((r) => r.age_group).map(([age_group, count]) => ({ age_group, count })),
    by_skin_type: counts((r) => r.skin_type).map(([skin_type, count]) => ({ skin_type, count })),
    age_by_concern: [...new Set(responses.map((r) => r.age_group))].map((age_group) => {
      const concerns: Record<string, number> = {};
      for (const r of responses.filter((r) => r.age_group === age_group))
        for (const concern of new Set(r.concerns)) concerns[concern] = (concerns[concern] ?? 0) + 1;
      return { age_group, counts: concerns };
    }),
    concern_other: responses.filter((r) => r.concern_other).map((r) => ({ text_ja: r.concern_other, text_ko: r.concern_other_ko ?? "", date: r.created_at.slice(0, 10) })),
    product_lines: [...new Set(events.map((r) => r.product_line))].map((line_id) => ({
      line_id, shown: events.filter((r) => r.product_line === line_id && r.event === "shown").length,
      clicks: events.filter((r) => r.product_line === line_id && r.event === "buy_click").length,
      // 신청 완료나 사람 수가 아닌 화면 열기 이벤트 횟수
      notify_open: events.filter((r) => r.product_line === line_id && r.event === "notify_open").length,
    })),
    responses: responses.sort((a, b) => b.created_at.localeCompare(a.created_at)).map((r) => ({
      at: r.created_at, age_group: r.age_group, skin_type: r.skin_type, is_sensitive: r.is_sensitive,
      concerns: r.concerns, concern_other: r.concern_other, concern_other_ko: r.concern_other_ko ?? null,
      source: r.source, consent_version: r.consent_version,
    })),
  });
}

export async function readDashboardQuestions() {
  const rows = await readRows("surveys");
  if (!rows) return mock.surveyQuestions;
  const surveys = Survey.array().parse(rows).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const questions = new Map<string, Survey["questions"][number]>();
  for (const survey of surveys) for (const question of survey.questions) if (!questions.has(question.id)) questions.set(question.id, question);
  return [...questions.values()];
}
