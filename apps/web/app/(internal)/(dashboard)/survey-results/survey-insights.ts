import type { SkinType, SurveyProductLine, SurveySource, SurveySummary } from "@/lib/schemas/survey";

// 설문 집계 화면의 이름표와, 요약 탭 "이번 설문에서 알 수 있는 것" · "한눈에 보기"에 쓰는 계산

export const SKIN: Record<SkinType, { ko: string; ja: string }> = {
  dry: { ko: "건성", ja: "乾燥肌" },
  oily: { ko: "지성", ja: "脂性肌" },
  combo: { ko: "복합성", ja: "混合肌" },
  inner_dry: { ko: "복합성(속건조)", ja: "インナードライ" },
  normal: { ko: "중성", ja: "普通肌" },
};
export const AGE_ORDER = ["18-19", "20s", "30s", "40s", "50plus"];
export const AGE_KO: Record<string, string> = {
  under18: "17세 이하",
  "18-19": "18~19세",
  "20s": "20대",
  "30s": "30대",
  "40s": "40대",
  "50plus": "50대 이상",
};
export const CONCERN_KO: Record<string, string> = {
  dryness: "건조·당김",
  shine: "번들거림·모공",
  acne: "여드름·트러블",
  dullness: "칙칙함",
  redness: "붉어짐·자극",
  firmness: "탄력·잔주름",
  other: "기타",
};
export const SOURCE_KO: Record<SurveySource, string> = {
  instagram: "Instagram",
  x: "X",
  line: "LINE",
  rakuten: "라쿠텐",
  qoo10: "Qoo10",
  friend: "지인 소개",
  search: "검색",
  other: "기타",
};

export const ageRank = (age: string) => (AGE_ORDER.includes(age) ? AGE_ORDER.indexOf(age) : AGE_ORDER.length);
export const pct = (n: number, total: number) => `${total ? Math.round((n / total) * 100) : 0}%`;
export const lineName = (line: SurveyProductLine | undefined, id: string) => line?.short_ko ?? line?.name_ko ?? id;
// 문장 속에서는 "Mild 라인" 대신 "Mild"로 줄여 부른다
const bareName = (line: SurveyProductLine | undefined, id: string) => lineName(line, id).replace(/ 라인$/, "");

export type LineReaction = { id: string; name: string; onSale: boolean; shown: number; reacted: number | null };

/** 라인별 반응: 판매 중은 구매하기 클릭, 개발 중은 출시 알림. 숫자가 없으면 reacted는 null */
export function lineReactions(summary: SurveySummary, lines: SurveyProductLine[]): LineReaction[] {
  return summary.product_lines.map((p) => {
    const line = lines.find((l) => l.id === p.line_id);
    const onSale = line?.status === "on_sale";
    const notify = p.notify_email === undefined && p.notify_line === undefined ? (p.notify_open ?? null) : (p.notify_email ?? 0) + (p.notify_line ?? 0);
    return { id: p.line_id, name: bareName(line, p.line_id), onSale, shown: p.shown, reacted: onSale ? (p.clicks ?? null) : notify };
  });
}

/** 고민별 응답 수 (복수 선택) */
export function concernTotals(summary: SurveySummary, keys: string[]) {
  return keys
    .map((key) => ({ key, count: summary.age_by_concern.reduce((sum, row) => sum + (row.counts[key] ?? 0), 0) }))
    .sort((a, b) => b.count - a.count);
}

/** 연령대별 1위 고민. 1위가 같은 연령대끼리 묶는다 (예: 30대·40대 번들거림·모공) */
export function topConcernByAge(summary: SurveySummary) {
  const rows = summary.age_by_concern
    .toSorted((a, b) => ageRank(a.age_group) - ageRank(b.age_group))
    .map((row) => {
      const entries = Object.entries(row.counts).filter(([k]) => k !== "other");
      const max = Math.max(0, ...entries.map(([, n]) => n));
      const top = entries.filter(([, n]) => n === max && n > 0).map(([k]) => CONCERN_KO[k] ?? k).join(", ");
      return { age: AGE_KO[row.age_group] ?? row.age_group, top };
    })
    .filter((r) => r.top);
  const groups: { ages: string[]; top: string }[] = [];
  for (const r of rows) {
    const last = groups.at(-1);
    if (last && last.top === r.top) last.ages.push(r.age);
    else groups.push({ ages: [r.age], top: r.top });
  }
  return groups.map((g) => `${g.ages.join("·")} ${g.top}`).join(" / ");
}

export type Insight = { headline: string; evidence: string };

/** "이번 설문에서 알 수 있는 것": 다음 제품 · 먼저 들어갈 입점처를 정하는 데 쓰는 결론만 */
export function surveyInsights(summary: SurveySummary, lines: SurveyProductLine[], concernKeys: string[]): Insight[] {
  const insights: Insight[] = [];
  const total = summary.total;
  const topType = summary.by_skin_type.toSorted((a, b) => b.count - a.count)[0];
  const topConcern = concernTotals(summary, concernKeys).filter((c) => c.key !== "other")[0];
  const onSale = lines.filter((l) => l.status === "on_sale");

  // 1. 가장 많은 피부타입과 판매 중인 라인이 맞는지
  if (topType) {
    const type = SKIN[topType.skin_type].ko;
    const covered = onSale.some((l) => l.for_types.includes(topType.skin_type));
    insights.push({
      headline: covered
        ? `응답자 ${pct(topType.count, total)}가 ${type}이고, 판매 중인 라인이 ${type}에 맞아요`
        : `응답자 ${pct(topType.count, total)}가 ${type}인데, 판매 중인 라인은 ${type}용이 아니에요`,
      evidence: [
        `${type} ${topType.count}명`,
        topConcern && `고민 1위 ${CONCERN_KO[topConcern.key] ?? topConcern.key} ${topConcern.count}명`,
        onSale.length > 0 && `판매 중 ${onSale.map((l) => bareName(l, l.id)).join(", ")}`,
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }

  // 2. 개발 중 라인의 출시 알림 vs 판매 중 라인의 구매 클릭 (알림 숫자가 없으면 비교하지 않는다)
  const reactions = lineReactions(summary, lines).filter((r) => r.reacted !== null && r.shown > 0);
  const rate = (r: LineReaction) => (r.reacted ?? 0) / r.shown;
  const dev = reactions.filter((r) => !r.onSale);
  const sale = reactions.filter((r) => r.onSale);
  if (dev.length > 0 && sale.length > 0) {
    const devWins = Math.max(...dev.map(rate)) > Math.max(...sale.map(rate));
    insights.push({
      headline: devWins
        ? "개발 중 라인의 출시 알림이 판매 중 라인의 구매 클릭보다 많아요"
        : "판매 중 라인의 구매 클릭이 개발 중 라인의 출시 알림보다 많아요",
      evidence: `출시 알림 ${dev.map((r) => `${r.name} ${pct(r.reacted ?? 0, r.shown)}`).join(" · ")} · ${sale
        .map((r) => `${r.name} 구매하기 클릭 ${pct(r.reacted ?? 0, r.shown)}`)
        .join(" · ")} → 다음 출시 순서를 정할 근거`,
    });
  }

  // 3. 응답이 가장 많은 채널과 그 채널의 피부타입
  const sources = summary.by_source.toSorted((a, b) => b.count - a.count);
  const top = sources[0];
  if (top) {
    const name = SOURCE_KO[top.source];
    const mostClicks = top.clicks !== undefined && sources.every((s) => (s.clicks ?? 0) <= (top.clicks ?? 0));
    const what = `${name}에서 온 ${mostClicks ? "응답과 구매 클릭이" : "응답이"} 가장 많`;
    let headline = `${what}아요`;
    if (top.top_skin_type && top.top_skin_count) {
      const share = top.top_skin_count / top.count;
      const amount = share >= 0.45 && share <= 0.55 ? "절반이" : `${pct(top.top_skin_count, top.count)}가`;
      headline = `${what}고, 그중 ${amount} ${SKIN[top.top_skin_type].ko}이에요`;
    }
    insights.push({
      headline,
      evidence: [
        `${name} 응답 ${top.count}건(${pct(top.count, total)})`,
        top.clicks !== undefined && `구매하기 클릭 ${top.clicks}회`,
        top.top_skin_type && `${SKIN[top.top_skin_type].ko} ${top.top_skin_count}명`,
      ]
        .filter(Boolean)
        .join(" · ")
        .concat(" → 먼저 힘을 줄 입점처와 그곳에 낼 라인을 정할 근거"),
    });
  }
  return insights;
}
