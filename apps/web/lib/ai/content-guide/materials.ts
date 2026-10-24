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

type PromoLike = { platform: string; title: string; start_date: string; end_date: string; kind?: string };

/** 오늘 이후(또는 진행 중) 가장 가까운 Qoo10 메가와리 일정을 프롬프트 [행사] 글로. 없으면 null → AI는 날짜를 쓰지 않는다 */
export function pickMegaSale(events: PromoLike[], today: string): string | null {
  const next = events
    .filter((e) => e.platform === "Qoo10" && /メガ割|메가와리/.test(e.title) && e.end_date >= today)
    .toSorted((a, b) => a.start_date.localeCompare(b.start_date))[0];
  return next ? `Qoo10メガ割 ${next.start_date}~${next.end_date} / 사은품: 없음` : null;
}
