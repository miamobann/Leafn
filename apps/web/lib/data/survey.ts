import { z } from "zod";
import { mock } from "@/lib/mock";
import { SkinSurveyResponse, SurveySummary, Survey } from "@/lib/schemas/survey";
import { readRows } from "./db";

const Minor = z.object({ count: z.number().int().nonnegative() });
const Event = z.object({ product_line: z.string(), event: z.enum(["shown", "buy_click", "notify_open"]) });

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
  return SurveySummary.parse({
    total: responses.length,
    recent_7d: responses.filter((r) => r.created_at >= weekAgo).length,
    under18_count: minors.reduce((sum, r) => sum + r.count, 0),
    sensitive_count: responses.filter((r) => r.is_sensitive).length,
    // 채널별 구매 클릭 · 출시 알림은 survey_reco_events에 유입 경로가 없어 비워 둔다 (화면에는 "—")
    by_source: counts((r) => r.source ?? "other").map(([source, count]) => {
      const types = new Map<string, number>();
      for (const r of responses) if ((r.source ?? "other") === source) types.set(r.skin_type, (types.get(r.skin_type) ?? 0) + 1);
      const [top_skin_type, top_skin_count] = [...types].sort((a, b) => b[1] - a[1])[0];
      return { source, count, top_skin_type, top_skin_count };
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
    concern_other: responses.filter((r) => r.concern_other).map((r) => ({ text_ja: r.concern_other, text_ko: "", date: r.created_at.slice(0, 10) })),
    product_lines: [...new Set(events.map((r) => r.product_line))].map((line_id) => ({
      line_id, shown: events.filter((r) => r.product_line === line_id && r.event === "shown").length,
      clicks: events.filter((r) => r.product_line === line_id && r.event === "buy_click").length,
      // notify_open은 신청 완료가 아니므로 알림 신청 수로 집계하지 않는다.
    })),
    recent: responses.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 10).map((r) => ({
      at: r.created_at, age_group: r.age_group, skin_type: r.skin_type, is_sensitive: r.is_sensitive,
      concerns: r.concerns, source: r.source, consent_version: r.consent_version,
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
