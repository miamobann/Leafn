// 플랫폼 수집 화면(프로토타입)용 샘플 랭킹. 실제 수집·저장은 하지 않는다.
// 가상 브랜드만 쓰고(DB_RULES 4.3), 같은 입력이면 항상 같은 결과가 나오도록 계산으로만 만든다.
// 수집 방식(조사 결과): 구매자 리뷰 목록을 낮은 별점순으로 읽다가, 고른 별점을 넘거나 최대 건수에 닿으면 멈춘다.

export type CollectStatus = "done" | "partial" | "failed" | "none" | "queued" | "running";
export type RankChange = "same" | "up" | "down" | "new";

export type SampleRow = {
  rank: number;
  change: RankChange;
  delta: number;
  brand: string;
  name: string;
  isAd: boolean; // 랭킹의 PR(광고) 표시 상품
  isSet: boolean; // 세트·기획 상품 (비교 대상으로 부적합)
  siteCount: number; // 사이트에 표시된 전체 리뷰 수
  lowAvail: number; // 고른 별점 이하 리뷰 수 (미리보기로 센 값)
  nonProduct: number; // 제품 외 불만(배송·누락·응대)이 차지하는 비율 %
  collected: number; // 가져온 리뷰 수
  stars: number[]; // 가져온 리뷰의 별점별 개수 [1점 … 5점]
  status: CollectStatus;
  lastCollected: string | null;
  note: string | null;
};

export const CATEGORIES = [
  { id: "toner", label: "化粧水 (스킨·토너)", suffix: " 詰め替え" },
  { id: "serum", label: "美容液 (세럼·에센스)", suffix: " 30ml" },
] as const;
export const TOP_N_OPTIONS = [10, 20, 30, 50] as const;
export const MAX_STAR_OPTIONS = [
  { value: 3, label: "1~3점 (기본)" },
  { value: 4, label: "1~4점" },
  { value: 5, label: "전체" },
] as const;
export const REVIEW_LIMITS = [
  { value: 50, label: "최대 50건" },
  { value: 100, label: "최대 100건" },
  { value: 200, label: "최대 200건" },
] as const;
export const MIN_LOW_OPTIONS = [
  { value: 0, label: "제한 없음" },
  { value: 10, label: "10건 이상" },
  { value: 30, label: "30건 이상" },
  { value: 50, label: "50건 이상" },
] as const;

const STEMS: Record<string, string[]> = {
  toner: [
    "ヒアルロン酸ローション", "セラミド化粧水", "ビタミンCローション", "ハトムギ化粧水", "アミノ酸化粧水",
    "ドクダミトナー", "ナイアシンアミドトナー", "米発酵化粧水", "CICAトナー", "とろみ保湿ローション",
    "ピーチ化粧水", "黒糖トナー", "ティーツリー化粧水", "プロポリストナー", "ヨモギ化粧水",
    "海洋深層水ローション", "ライスブランローション", "カミツレ化粧水", "ツボクサトナー", "アロエ保湿水",
    "パンテノールトナー", "グリーンティートナー", "ブルーベリー化粧水", "ユズ化粧水", "マヌカハニートナー",
  ],
  serum: [
    "レチノールセラム", "ビタミンC美容液", "ナイアシンアミドセラム", "PDRNアンプル", "ヒアルロン酸アンプル",
    "CICAアンプル", "ペプチドセラム", "グルタチオン美容液", "発酵エッセンス", "アゼライン酸セラム",
    "コラーゲンアンプル", "セラミドエッセンス", "バクチオールセラム", "スクワラン美容液", "プロテオグリカン美容液",
    "エクソソームセラム", "水分ブースター", "ティーツリーセラム", "ヒアルロン酸ショット", "ビタミンE美容液",
    "ナイトリペアアンプル", "アロエエッセンス", "パンテノールセラム", "青みかんセラム", "ハトムギ美容液",
  ],
};

const BASE_COUNT: Record<string, number> = { qoo10: 1800, rakuten: 1100 };
const PREVIOUSLY_COLLECTED_TOP = 12; // 지난번에 순위 12위까지 가져온 것으로 가정

// 고른 별점 이하 리뷰가 전체에서 차지하는 비율 (샘플). 제품마다 크게 다르다.
const LOW_RATIO: Record<number, number> = { 3: 0.07, 4: 0.2, 5: 1 };
// 가져온 리뷰의 별점 분포 (샘플). 낮은 별점부터 읽으므로 고른 별점 안에서만 나눈다.
const STAR_WEIGHTS: Record<number, number[]> = {
  3: [0.15, 0.25, 0.6, 0, 0],
  4: [0.1, 0.18, 0.4, 0.32, 0],
  5: [0.03, 0.05, 0.1, 0.25, 0.57],
};

const NOTE = {
  partial: "일부 페이지에서 시간이 초과됐어요 (샘플)",
  failed: "리뷰 페이지를 읽지 못했어요 (샘플)",
} as const;

/** 샘플에서 일부러 막히게 하는 순위: 7로 나눈 나머지가 2면 일부 누락, 11로 나눈 나머지가 5면 실패 */
const blockedAs = (rank: number): "partial" | "failed" | null =>
  rank % 11 === 5 ? "failed" : rank % 7 === 2 ? "partial" : null;

function lowAvailable(rank: number, siteCount: number, maxStar: number): number {
  if (maxStar >= 5) return siteCount;
  if (rank % 9 === 0) return rank % 7; // 저평점이 거의 없는 제품
  const spread = 0.4 + ((rank * 13) % 11) / 10; // 제품마다 0.4 ~ 1.4배
  return Math.round(siteCount * (LOW_RATIO[maxStar] ?? 0.07) * spread);
}

function splitStars(total: number, maxStar: number): number[] {
  const weights = STAR_WEIGHTS[maxStar] ?? STAR_WEIGHTS[3];
  const out = weights.map((w) => Math.floor(total * w));
  out[Math.min(maxStar, 5) - 1] += total - out.reduce((a, b) => a + b, 0);
  return out;
}

const withResult = (
  row: Omit<SampleRow, "collected" | "stars" | "status" | "lastCollected" | "note">,
  collected: number,
  maxStar: number,
  status: CollectStatus,
  lastCollected: string | null,
  note: string | null,
): SampleRow => ({ ...row, collected, stars: splitStars(collected, maxStar), status, lastCollected, note });

export function sampleRanking(platformId: string, categoryId: string, topN: number, maxStar: number, limit: number): SampleRow[] {
  const category = CATEGORIES.find((c) => c.id === categoryId) ?? CATEGORIES[0];
  const stems = STEMS[category.id];
  const shift = platformId === "rakuten" ? 3 : 0; // 플랫폼마다 목록이 다르게 보이도록
  return Array.from({ length: topN }, (_, i) => {
    const rank = i + 1;
    const j = i + shift;
    const stem = stems[j % stems.length];
    const baseName = j >= stems.length ? `${stem}${category.suffix}` : stem;
    const isAd = platformId === "qoo10" && rank === 1;
    const isSet = rank % 9 === 6;
    const siteCount = Math.round((BASE_COUNT[platformId] ?? 1000) / Math.sqrt(rank) + ((rank * 37) % 90));
    const change: RankChange = rank % 13 === 4 ? "new" : rank % 5 === 0 ? "up" : rank % 7 === 3 ? "down" : "same";
    const lowAvail = lowAvailable(rank, siteCount, maxStar);
    const base = {
      rank,
      change,
      delta: change === "up" ? 2 : change === "down" ? 1 : 0,
      brand: `Sample${String.fromCharCode(65 + ((j + 8 * shift) % 26))}${j >= 26 ? "2" : ""}`,
      name: isSet ? `${baseName} 2本セット` : baseName,
      isAd,
      isSet,
      siteCount,
      lowAvail,
      nonProduct: 15 + ((rank * 17) % 40),
    };
    const wasCollected = rank <= PREVIOUSLY_COLLECTED_TOP && change !== "new" && !isAd && !isSet && lowAvail > 0;
    if (!wasCollected) return withResult(base, 0, maxStar, "none", null, null);
    const want = Math.min(limit, lowAvail);
    const lastCollected = `10/22 ${String(9 + (rank % 3)).padStart(2, "0")}:${String((rank * 7) % 60).padStart(2, "0")}`;
    const blocked = blockedAs(rank);
    if (blocked === "failed") return withResult(base, 0, maxStar, "failed", lastCollected, NOTE.failed);
    if (blocked === "partial") return withResult(base, Math.round(want * 0.4), maxStar, "partial", lastCollected, NOTE.partial);
    return withResult(base, want, maxStar, "done", lastCollected, null);
  });
}

/** 수집이 끝난 한 줄의 모습. retry면 막힌 제품도 이번에는 성공한다 (다시 가져오기 시연용) */
export function finishRow(row: SampleRow, limit: number, maxStar: number, retry: boolean): SampleRow {
  const want = Math.min(limit, row.lowAvail);
  const blocked = retry ? null : blockedAs(row.rank);
  const base = {
    rank: row.rank,
    change: row.change,
    delta: row.delta,
    brand: row.brand,
    name: row.name,
    isAd: row.isAd,
    isSet: row.isSet,
    siteCount: row.siteCount,
    lowAvail: row.lowAvail,
    nonProduct: row.nonProduct,
  };
  if (blocked === "failed") return withResult(base, 0, maxStar, "failed", "방금 전", NOTE.failed);
  if (blocked === "partial") return withResult(base, Math.round(want * 0.4), maxStar, "partial", "방금 전", NOTE.partial);
  return withResult(base, want, maxStar, "done", "방금 전", null);
}
