// 제작 재료를 데이터에서 고르는 함수 (AI 호출 없음): 후기에 쓸 리뷰 원문 · 메가와리 일정.

/** 한국어 리뷰 단계에서 먼저 빼는 말. 번역하면 저자극·치료·즉효로 읽히기 쉬워서 AI에 보내지 않는다 */
const RISKY_REVIEW_KO = /순하|뒤집어|예민|따갑|따가|오래\s?가|오래가|하루\s?종일|자극|트러블|여드름|뾰루지|진정|나았|낫|치료|민감|홍조|붉은|하루\s?만|며칠\s?만|\d+\s?일\s?만|미백|화이트닝|주름\s?(이\s?)?(없|사라)/;

export const MAX_REVIEW_QUOTES = 4;

type ReviewLike = { body: string; rating: number };
type TopicLike = { praises: ReviewLike[]; praiseShare: number };

/** 칭찬이 많은 주제부터 1개씩 리뷰를 고른다 (주제마다 다른 장점). 위험한 말이 있는 리뷰, 너무 짧거나 긴 리뷰는 뺀다 */
export function pickReviewQuotes(topics: TopicLike[], max = MAX_REVIEW_QUOTES): string[] {
  const picked: string[] = [];
  for (const topic of topics.filter((t) => t.praises.length > 0).toSorted((a, b) => b.praiseShare - a.praiseShare)) {
    const best = topic.praises
      .filter((r) => r.body.length >= 10 && r.body.length <= 80 && !RISKY_REVIEW_KO.test(r.body) && !picked.includes(r.body))
      .toSorted((a, b) => b.rating - a.rating || a.body.length - b.body.length)[0];
    if (best) picked.push(best.body);
    if (picked.length >= max) break;
  }
  return picked;
}

/** 승인된 일본어 후기 (리뷰 탭에서 번역 → 약기법 검토 → 팀장 승인). 이미 약기법을 통과해 위험어 필터는 걸지 않고 길이만 본다.
 *  말풍선 한 줄에 들어가는 길이만 (5~120자), 같은 문장은 한 번, 최신순 최대 4개 */
export function pickApprovedQuotes(quotes: { textJa: string; reviewTranslationId: string }[], max = MAX_REVIEW_QUOTES): { text_ja: string; translation_id: string }[] {
  const picked: { text_ja: string; translation_id: string }[] = [];
  for (const q of quotes) {
    const text = q.textJa.trim();
    if (text.length < 5 || text.length > 120 || picked.some((p) => p.text_ja === text)) continue;
    picked.push({ text_ja: text, translation_id: q.reviewTranslationId });
    if (picked.length >= max) break;
  }
  return picked;
}

type PromoLike = { platform: string; title: string; start_date: string; end_date: string; kind?: string };

/** 오늘 이후(또는 진행 중) 가장 가까운 Qoo10 메가와리 일정을 프롬프트 [행사] 글로. 없으면 null → AI는 날짜를 쓰지 않는다 */
export function pickMegaSale(events: PromoLike[], today: string): string | null {
  const next = events
    .filter((e) => (e.platform === "qoo10" || e.platform === "Qoo10") && /メガ割|메가와리/.test(e.title) && e.end_date >= today)
    .toSorted((a, b) => a.start_date.localeCompare(b.start_date))[0];
  return next ? `Qoo10メガ割 ${next.start_date}~${next.end_date} / 사은품: 없음` : null;
}

// ── 리뷰 소구점 이름을 광고용으로 (약기법 우선, 2026-10-25) ──────────────
// 리뷰 분석의 주제 이름은 소비자 말이라 그대로 AI에 넘기면 광고 문구가 근거 없는 표현이 되기 쉽다.
// - 순함(저자극): 근거 자료 없이 쓸 수 없다 (가이드라인 F7.5) → 소구점에서 뺀다
// - 오래가는 보습(효과 지속): 근거 자료 없이 쓸 수 없다 → 사용감 표현 「촉촉한 보습감」으로 바꿔 넘긴다

/** 칭찬·소구점 후보로 넘길 이름. null 이면 넘기지 않는다 */
const SAFE_PRAISE: Record<string, string | null> = { irritation: null, lasting_moisture: "촉촉한 보습감" };
/** 경쟁 불만으로 넘길 이름 (대비 문구로 저자극을 주장하지 않게 단서를 붙인다) */
const SAFE_COMPLAINT: Record<string, string> = { irritation: "자극 (우리 제품의 저자극은 주장하지 않는다)" };

/** 칭찬·후보 주제 → 광고에 써도 되는 이름. 뺀 주제는 dropped 로 돌려준다 (화면 안내용) */
export function safePraiseLabels(topics: { key: string; ko: string }[]): { labels: string[]; dropped: string[] } {
  const labels: string[] = [];
  const dropped: string[] = [];
  for (const t of topics) {
    const safe = t.key in SAFE_PRAISE ? SAFE_PRAISE[t.key] : t.ko;
    if (safe === null) dropped.push(t.ko);
    else if (!labels.includes(safe)) labels.push(safe);
  }
  return { labels, dropped };
}

export function safeComplaintLabel(key: string, ko: string): string {
  return SAFE_COMPLAINT[key] ?? ko;
}
