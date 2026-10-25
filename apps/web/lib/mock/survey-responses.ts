import { SkinSurveyResponse, Survey, SurveySummary, type SkinType, type SurveyAnswer, type SurveySource } from "@/lib/schemas/survey";
import { calcScores, judge } from "@/lib/survey/judge";
import { WORKSPACE_ID, parseAll } from "./helpers";
import { surveyProductLines, surveyQuestions } from "./survey";

// 더미 응답 (실제 저장 연결 전 대시보드 확인용). 실제 사람의 응답이 아니다.
// 일본 성인 여성 피부타입 자기인식 비율(混合39 · 普通29 · 敏感23 · 乾燥11%, 脂性은 5%로 가정)에 맞춘 가상 응답자가
// 실제 문항에 답하게 하고, 피부타입 · 점수는 설문 화면과 같은 판정 로직(lib/survey/judge.ts)으로 계산한다.
// 같은 결과가 나오도록 시드를 고정한 난수를 쓴다 (빌드마다 숫자가 바뀌지 않게)

const RESPONSE_COUNT = 150;
const DAYS = 30;
// 설문은 다른 가짜 데이터(PROTOTYPE_TODAY)와 따로, 11월 한 달 동안 받은 것으로 둔다
const SURVEY_TODAY = "2026-11-30";

export const survey = Survey.parse({
  id: "sv-leafn",
  created_at: "2026-10-30T10:00:00+09:00",
  workspace_id: WORKSPACE_ID,
  public_slug: "leafn",
  title_ja: "肌タイプ診断",
  questions: surveyQuestions,
  is_open: true,
});

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261023);

function pick<T>(items: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

// 가상 응답자 타입별로 문항 선택지를 고를 확률 (선택지 순서는 lib/mock/survey.ts와 같다)
type Persona = "dry" | "combo" | "normal" | "oily";
const PERSONA_WEIGHT: Record<Persona, number> = { combo: 39, normal: 29, dry: 11, oily: 5 };
const OPTION_WEIGHTS: Record<Persona, Record<string, number[]>> = {
  dry: { after_wash: [45, 35, 15, 5], t_zone: [2, 10, 38, 50], cheek: [0, 15, 25, 60], pores: [5, 25, 70], moisturizer: [60, 38, 2], blotting: [2, 13, 85] },
  combo: { after_wash: [10, 45, 30, 15], t_zone: [45, 40, 13, 2], cheek: [5, 25, 30, 40], pores: [15, 70, 15], moisturizer: [30, 60, 10], blotting: [35, 45, 20] },
  normal: { after_wash: [3, 17, 45, 35], t_zone: [5, 30, 50, 15], cheek: [5, 60, 30, 5], pores: [10, 40, 50], moisturizer: [10, 70, 20], blotting: [8, 30, 62] },
  oily: { after_wash: [2, 8, 30, 60], t_zone: [65, 30, 5, 0], cheek: [70, 20, 8, 2], pores: [65, 30, 5], moisturizer: [10, 50, 40], blotting: [70, 25, 5] },
};
const SENSITIVE_RATE = 0.23;
const NEW_PRODUCT_WEIGHTS = { sensitive: [30, 45, 20, 5], other: [2, 13, 35, 50] };
const TRIGGER_COUNT_WEIGHTS = { sensitive: [5, 20, 30, 25, 12, 8], other: [45, 30, 15, 7, 2, 1] };

const AGE_WEIGHTS: Record<string, number> = { "18-19": 8, "20s": 30, "30s": 28, "40s": 22, "50plus": 12 };
// 상세페이지 링크로 들어오는 쇼핑몰이 가장 많고(첫 입점처 Qoo10 > 라쿠텐), SNS가 뒤따르는 모양
const SOURCE_WEIGHTS: Record<SurveySource, number> = { qoo10: 30, rakuten: 24, instagram: 14, line: 9, x: 7, friend: 6, search: 6, other: 4 };
const SOURCE_OTHER = ["雑誌", "店頭のPOP", "YouTube"];

// 고민 선택 가중치: 피부타입 · 연령대 · 민감에 따라 달라진다
function concernWeights(type: SkinType, age: string, sensitive: boolean): Record<string, number> {
  const w: Record<string, number> = { dryness: 3, shine: 3, acne: 2, dullness: 2, redness: 1, firmness: 1 };
  if (type === "dry" || type === "inner_dry") w.dryness += 6;
  if (type === "oily" || type === "combo" || type === "inner_dry") w.shine += 6;
  if (type === "oily") w.acne += 3;
  if (sensitive) w.redness += 5;
  if (age === "18-19" || age === "20s") w.acne += 4;
  if (age === "40s" || age === "50plus") {
    w.firmness += 6;
    w.dullness += 3;
  }
  return w;
}
// '기타' 직접 입력. 한 사람이 한 문장씩, 겹치지 않게 순서대로 쓴다
const CONCERN_OTHER: { ja: string; ko: string }[] = [
  { ja: "夕方になると目元が乾いて小じわが目立つ", ko: "저녁이 되면 눈가가 건조해져 잔주름이 눈에 띄어요" },
  { ja: "生理前にあごまわりにニキビができやすい", ko: "생리 전에 턱 주변에 여드름이 잘 나요" },
  { ja: "ファンデーションが毛穴に落ちてしまう", ko: "파운데이션이 모공에 끼어요" },
  { ja: "首のしわが気になってきた", ko: "목주름이 신경 쓰이기 시작했어요" },
  { ja: "マスクのこすれで鼻の下が赤くなる", ko: "마스크에 쓸려서 코 밑이 빨개져요" },
  { ja: "目の下のクマがなかなか消えない", ko: "눈 밑 다크서클이 잘 안 없어져요" },
  { ja: "髪の生え際に吹き出物ができる", ko: "헤어라인에 뾰루지가 나요" },
  { ja: "日焼けのあとにできたシミが薄くならない", ko: "햇볕에 탄 뒤 생긴 기미가 옅어지지 않아요" },
  { ja: "小鼻の黒ずみが取れない", ko: "콧방울 블랙헤드가 안 빠져요" },
  { ja: "冬になると口のまわりが粉をふく", ko: "겨울이 되면 입가에 각질이 일어나요" },
  { ja: "化粧水がなかなか肌になじまない", ko: "스킨이 피부에 잘 스며들지 않아요" },
  { ja: "午後になるとメイクがよれてくる", ko: "오후가 되면 화장이 밀려요" },
  { ja: "頬の毛穴が縦に伸びて見える", ko: "볼 모공이 세로로 늘어져 보여요" },
  { ja: "季節の変わり目に肌がごわつく", ko: "환절기에 피부가 거칠어져요" },
  { ja: "寝不足の日は顔色がくすむ", ko: "잠을 못 잔 날은 안색이 칙칙해요" },
];
let concernOtherNext = 0;

function optionValue(questionId: string, index: number): string {
  const q = surveyQuestions.find((x) => x.id === questionId);
  if (!q) throw new Error(`더미 응답: 문항 ${questionId} 없음`);
  return q.options[index].value;
}

function dateOf(daysAgo: number, minutes: number): string {
  const base = Date.UTC(+SURVEY_TODAY.slice(0, 4), +SURVEY_TODAY.slice(5, 7) - 1, +SURVEY_TODAY.slice(8, 10));
  const d = new Date(base - daysAgo * 86_400_000 + minutes * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00+09:00`;
}

function makeResponse(i: number) {
  const persona = pick(Object.keys(PERSONA_WEIGHT) as Persona[], Object.values(PERSONA_WEIGHT));
  const sensitive = rand() < SENSITIVE_RATE;
  const age = pick(Object.keys(AGE_WEIGHTS), Object.values(AGE_WEIGHTS));
  const answers: Record<string, SurveyAnswer> = { age };
  for (const [qid, weights] of Object.entries(OPTION_WEIGHTS[persona])) {
    answers[qid] = optionValue(qid, pick(weights.map((_, k) => k), weights));
  }
  const npw = sensitive ? NEW_PRODUCT_WEIGHTS.sensitive : NEW_PRODUCT_WEIGHTS.other;
  answers.new_product = optionValue("new_product", pick(npw.map((_, k) => k), npw));
  const tcw = sensitive ? TRIGGER_COUNT_WEIGHTS.sensitive : TRIGGER_COUNT_WEIGHTS.other;
  const triggerCount = pick(tcw.map((_, k) => k), tcw);
  const triggerPool = ["season", "pollen", "mask", "sun", "sweat"].sort(() => rand() - 0.5);
  answers.triggers = triggerCount === 0 ? ["none"] : triggerPool.slice(0, triggerCount);

  const scores = calcScores(surveyQuestions, answers);
  const { skinType, isSensitive } = judge(scores);

  const cw = concernWeights(skinType, age, isSensitive);
  const concernCount = pick([1, 2, 3], [45, 40, 15]);
  const concerns = new Set<string>();
  while (concerns.size < concernCount) concerns.add(pick(Object.keys(cw), Object.values(cw)));
  let concernOther: { ja: string; ko: string } | null = null;
  if (rand() < 0.05) {
    rand(); // 예전 무작위 고르기 자리. 난수 순서를 지켜 다른 답이 바뀌지 않게 한다
    concernOther = CONCERN_OTHER[concernOtherNext++ % CONCERN_OTHER.length];
    concerns.add("other");
  }
  answers.concerns = [...concerns];

  const source = pick(Object.keys(SOURCE_WEIGHTS) as SurveySource[], Object.values(SOURCE_WEIGHTS));
  // 최근 며칠에 몰리지 않게 한 달 동안 퍼뜨린다
  const daysAgo = Math.floor(rand() * DAYS);
  const minutes = 8 * 60 + Math.floor(rand() * 15 * 60);
  const createdAt = dateOf(daysAgo, minutes);

  return {
    row: {
      id: `sr-${String(i + 1).padStart(3, "0")}`,
      created_at: createdAt,
      workspace_id: WORKSPACE_ID,
      survey_id: survey.id,
      answers,
      age_group: age,
      skin_type: skinType,
      is_sensitive: isSensitive,
      score_t_zone_oil: scores.t,
      score_cheek_oil: scores.c,
      score_dryness: scores.d,
      score_sensitivity: scores.s,
      concerns: [...concerns],
      concern_other: concernOther?.ja ?? null,
      source,
      source_other: source === "other" ? SOURCE_OTHER[Math.floor(rand() * SOURCE_OTHER.length)] : null,
      consent_at: dateOf(daysAgo, minutes - 2),
      consent_version: "v0.1",
      locale: "ja",
    },
    concernOtherKo: concernOther?.ko ?? null,
  };
}

const generated = Array.from({ length: RESPONSE_COUNT }, (_, i) => makeResponse(i));
export const surveyResponses = parseAll(SkinSurveyResponse, generated.map((g) => g.row), "surveyResponses");

// 18세 미만 참여 수 (날짜별 숫자만)
export const surveyMinorCounts = Array.from({ length: DAYS }, (_, d) => ({
  date: dateOf(d, 0).slice(0, 10),
  count: rand() < 0.25 ? 1 : 0,
})).filter((m) => m.count > 0);

// --- 집계: 실제 DB 연결 후에는 같은 모양을 쿼리로 만든다 ---------------------------
function countBy<T>(rows: T[], key: (r: T) => string) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return m;
}

const weekAgo = dateOf(7, 0);
const typeCounts = countBy(surveyResponses, (r) => r.skin_type);
const shownFor = (types: SkinType[]) => types.reduce((sum, t) => sum + (typeCounts.get(t) ?? 0), 0);

export const surveySummary = SurveySummary.parse({
  total: surveyResponses.length,
  recent_7d: surveyResponses.filter((r) => r.created_at >= weekAgo).length,
  under18_count: surveyMinorCounts.reduce((sum, m) => sum + m.count, 0),
  sensitive_count: surveyResponses.filter((r) => r.is_sensitive).length,
  by_source: [...countBy(surveyResponses, (r) => r.source ?? "other")]
    .map(([source, count]) => {
      const rows = surveyResponses.filter((r) => (r.source ?? "other") === source);
      const [topType, topCount] = [...countBy(rows, (r) => r.skin_type)].sort((a, b) => b[1] - a[1])[0];
      const inLines = (status: "on_sale" | "in_development") =>
        rows.filter((r) => surveyProductLines.some((l) => l.status === status && l.for_types.includes(r.skin_type))).length;
      // 채널별 반응도 아래 product_lines와 같은 더미 비율 (구매 클릭 35% · 알림 신청 40%)
      return { source, count, top_skin_type: topType, top_skin_count: topCount, clicks: Math.round(inLines("on_sale") * 0.35), notify: Math.round(inLines("in_development") * 0.4) };
    })
    .sort((a, b) => b.count - a.count),
  period: {
    from: surveyResponses.reduce((min, r) => (r.created_at < min ? r.created_at : min), surveyResponses[0].created_at).slice(0, 10),
    to: surveyResponses.reduce((max, r) => (r.created_at > max ? r.created_at : max), surveyResponses[0].created_at).slice(0, 10),
  },
  by_age: Object.keys(AGE_WEIGHTS).map((age_group) => ({ age_group, count: surveyResponses.filter((r) => r.age_group === age_group).length })),
  by_skin_type: [...typeCounts].map(([skin_type, count]) => ({ skin_type, count })).sort((a, b) => b.count - a.count),
  age_by_concern: Object.keys(AGE_WEIGHTS).map((age_group) => {
    const rows = surveyResponses.filter((r) => r.age_group === age_group);
    const counts: Record<string, number> = {};
    for (const c of surveyQuestions.find((q) => q.id === "concerns")?.options ?? []) {
      counts[c.value] = rows.filter((r) => r.concerns.includes(c.value)).length;
    }
    return { age_group, counts };
  }),
  concern_other: generated
    .filter((g) => g.row.concern_other)
    .sort((a, b) => b.row.created_at.localeCompare(a.row.created_at))
    .map((g) => ({ text_ja: g.row.concern_other ?? "", text_ko: g.concernOtherKo ?? "", date: g.row.created_at.slice(0, 10) })),
  // 추천 반응은 더미 비율: 판매 중은 구매 클릭 약 35%, 개발 중은 알림 신청 약 40% (메일 45 : LINE 55)
  product_lines: surveyProductLines
    .filter((l) => l.id !== "moisture-essence")
    .map((l) => {
      const shown = shownFor(l.for_types);
      if (l.status === "on_sale") return { line_id: l.id, shown, clicks: Math.round(shown * 0.35) };
      const notify = Math.round(shown * 0.4);
      const email = Math.round(notify * 0.45);
      return { line_id: l.id, shown, notify_email: email, notify_line: notify - email };
    }),
  recent: surveyResponses
    .toSorted((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 10)
    .map((r) => ({
      at: r.created_at,
      age_group: r.age_group,
      skin_type: r.skin_type,
      is_sensitive: r.is_sensitive,
      concerns: r.concerns,
      source: r.source,
      consent_version: r.consent_version,
    })),
});
