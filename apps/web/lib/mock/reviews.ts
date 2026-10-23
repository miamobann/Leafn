import { Review } from "@/lib/schemas/review";
import { parseAll, ts, WORKSPACE_ID } from "./helpers";
import { ownKoReviewSeeds } from "./own-review-seeds";

// 실제 리뷰를 복사하지 않고 형식만 흉내 낸 샘플 (CLAUDE.md 0장)
// 줄 끝의 태그는 AI 분석이 붙일 주제 태그를 흉내 낸 것: +칭찬 / -불만 (review-analyses.ts가 읽는다)

// 자사 국내 리뷰 (올리브영): own-review-seeds.ts. samples/reviews-ko-skin.csv · reviews-ko-essence.csv와 같은 내용
const ko = ownKoReviewSeeds;

// 일본 리뷰 (楽天, 기존 경쟁 제품): [id, 제품, 평점, 본문, 한국어 해석, 肌質, 연령대, 태그]
const jaRakuten = [
  ["r-ja-1", "p-comp-1", 5, "さっぱりしていて毎日使いやすい。", "毎日 쓰기 편하고 산뜻해요.", "脂性肌", "20代", "+texture"],
  ["r-ja-2", "p-comp-1", 3, "少しべたつきが残るのが気になる。", "끈적임이 조금 남는 게 신경 쓰여요.", "混合肌", "30代", "-texture"],
  ["r-ja-3", "p-comp-2", 4, "保湿力は十分。容量がもう少し欲しい。", "보습력은 충분. 용량이 조금 더 있으면.", "乾燥肌", "40代", "+lasting_moisture -value"],
  ["r-ja-4", "p-comp-2", 2, "香りが強くて合わなかった。", "향이 강해서 안 맞았어요.", "敏感肌", "30代", "-scent"],
  ["r-ja-5", "p-comp-1", 4, "価格が手頃でリピートしています。", "가격이 적당해서 재구매 중이에요.", "普通肌", "20代", "+value"],
] as const;

// 일본 리뷰 (Qoo10 랭킹 TOP10, 제품당 3건): 제품 ID → [평점, 본문, 한국어 해석, 肌質, 연령대, 태그][]
type JaSeed = readonly [number, string, string, string, string, string];
const jaQoo10: Record<string, readonly JaSeed[]> = {
  "p-qsk-01": [
    [2, "つけた直後はしっとりするけど、1時間もすると乾燥してくる。", "바른 직후는 촉촉한데 1시간쯤 지나면 건조해져요.", "乾燥肌", "30代", "-lasting_moisture"],
    [3, "量が多くてコスパはいい。ただ保湿力は物足りない。", "양이 많아 가성비는 좋아요. 다만 보습력은 아쉬워요.", "混合肌", "20代", "+value -lasting_moisture"],
    [5, "さっぱりしていて夏にぴったり。", "산뜻해서 여름에 딱이에요.", "脂性肌", "20代", "+texture"],
  ],
  "p-qsk-02": [
    [2, "保湿はいいけど、肌に残るべたつきが苦手。", "보습은 좋은데 피부에 남는 끈적임이 싫어요.", "脂性肌", "20代", "-texture"],
    [3, "価格のわりに量が少なくてすぐなくなる。", "가격에 비해 양이 적어 금방 떨어져요.", "普通肌", "30代", "-value"],
    [4, "乾燥しやすい冬でも安心して使える。", "건조한 겨울에도 안심하고 써요.", "乾燥肌", "40代", "+lasting_moisture"],
  ],
  "p-qsk-03": [
    [1, "つけるとピリピリして赤くなった。", "바르면 따끔거리고 빨개졌어요.", "敏感肌", "20代", "-irritation"],
    [2, "アルコールの匂いが気になる。乾燥も感じる。", "알코올 냄새가 신경 쓰여요. 건조함도 느껴져요.", "混合肌", "30代", "-scent -lasting_moisture"],
    [3, "さっぱりしすぎて、すぐ肌がつっぱる。", "너무 산뜻해서 금방 피부가 당겨요.", "乾燥肌", "30代", "-lasting_moisture"],
  ],
  "p-qsk-04": [
    [2, "たっぷり使えるけど、保湿は全然続かない。", "듬뿍 쓸 수 있지만 보습이 전혀 지속되지 않아요.", "乾燥肌", "20代", "-lasting_moisture"],
    [3, "ボトルが大きくて出しすぎてしまう。", "병이 커서 너무 많이 나와요.", "普通肌", "30代", "-container"],
    [5, "安くて大容量、拭き取りに使っています。", "싸고 대용량이라 닦토로 써요.", "脂性肌", "10代", "+value"],
  ],
  "p-qsk-05": [
    [3, "低刺激なのはいいけど、少しべたつく。", "저자극인 건 좋은데 조금 끈적여요.", "敏感肌", "30代", "+irritation -texture"],
    [2, "夕方には乾燥してくる。重ねづけが必要。", "저녁이 되면 건조해져요. 덧발라야 해요.", "乾燥肌", "40代", "-lasting_moisture"],
    [4, "肌がやわらかくなる感じ。", "피부가 부드러워지는 느낌이에요.", "普通肌", "20代", ""],
  ],
  "p-qsk-06": [
    [2, "ドクダミの香りがどうしても苦手。", "어성초 향이 아무래도 싫어요.", "普通肌", "30代", "-scent"],
    [3, "キャップが開けにくく、液漏れした。", "뚜껑이 잘 안 열리고 내용물이 샜어요.", "混合肌", "20代", "-container"],
    [1, "数日でかゆみが出たので使用をやめた。", "며칠 만에 가려움이 생겨 사용을 중단했어요.", "敏感肌", "20代", "-irritation"],
  ],
  "p-qsk-07": [
    [2, "香料が強めで、つけた後も香りが残る。", "향료가 강해서 바른 뒤에도 향이 남아요.", "敏感肌", "30代", "-scent"],
    [3, "なじむまで時間がかかり、べたつく。", "흡수되기까지 시간이 걸리고 끈적여요.", "脂性肌", "20代", "-texture"],
    [3, "少しピリッとする日がある。", "가끔 살짝 따끔한 날이 있어요.", "混合肌", "30代", "-irritation"],
  ],
  "p-qsk-08": [
    [2, "独特の発酵臭が気になる。", "특유의 발효 냄새가 신경 쓰여요.", "普通肌", "40代", "-scent"],
    [3, "しっとりするけど、べたつきが残ってメイクがよれる。", "촉촉하지만 끈적임이 남아 메이크업이 밀려요.", "混合肌", "30代", "+lasting_moisture -texture"],
    [2, "この値段なら、もう少し量が欲しい。", "이 가격이면 양이 좀 더 있었으면 해요.", "乾燥肌", "30代", "-value"],
  ],
  "p-qsk-09": [
    [2, "時間がたつと乾燥する。保湿は弱め。", "시간이 지나면 건조해요. 보습은 약한 편이에요.", "乾燥肌", "20代", "-lasting_moisture"],
    [3, "香りが強くて、敏感な日はつらい。", "향이 강해서 예민한 날은 힘들어요.", "敏感肌", "20代", "-scent"],
    [5, "ニキビ肌でも使いやすい。", "여드름 피부도 쓰기 편해요.", "脂性肌", "10代", "+irritation"],
  ],
  "p-qsk-10": [
    [1, "とろみが強すぎて、いつまでもべたべたする。", "점도가 너무 강해서 계속 끈적거려요.", "脂性肌", "20代", "-texture"],
    [2, "ポンプがなく、手に出すとこぼれる。", "펌프가 없어서 손에 덜면 흘러요.", "普通肌", "30代", "-container"],
    [3, "保湿はいいけど夏は重い。", "보습은 좋은데 여름엔 무거워요.", "混合肌", "30代", "+lasting_moisture -texture"],
  ],
  "p-qes-01": [
    [1, "使い始めてから皮むけとヒリヒリが続いた。", "쓰기 시작한 뒤로 각질이 일어나고 화끈거림이 계속됐어요.", "敏感肌", "30代", "-irritation"],
    [2, "効果はありそうだけど刺激が強い。", "효과는 있을 것 같지만 자극이 강해요.", "混合肌", "40代", "-irritation"],
    [4, "ハリが出てきた気がする。", "탄력이 생긴 느낌이에요.", "普通肌", "40代", ""],
  ],
  "p-qes-02": [
    [2, "塗るとピリピリする。", "바르면 따끔거려요.", "敏感肌", "20代", "-irritation"],
    [3, "30mlですぐ終わる。コスパが悪い。", "30ml라 금방 다 써요. 가성비가 나빠요.", "普通肌", "30代", "-value"],
    [3, "乾燥する感じがある。", "건조해지는 느낌이 있어요.", "乾燥肌", "30代", "-lasting_moisture"],
  ],
  "p-qes-03": [
    [2, "香料のにおいが強い。", "향료 냄새가 강해요.", "敏感肌", "30代", "-scent"],
    [3, "重ねるとべたつく。", "덧바르면 끈적여요.", "脂性肌", "20代", "-texture"],
    [5, "毛穴が目立たなくなってきた。", "모공이 덜 눈에 띄게 됐어요.", "混合肌", "20代", ""],
  ],
  "p-qes-04": [
    [2, "高いのに量が少なく、続けにくい。", "비싼데 양이 적어서 계속 쓰기 어려워요.", "普通肌", "40代", "-value"],
    [3, "テクスチャーが重く、なじみにくい。", "제형이 무겁고 잘 스며들지 않아요.", "脂性肌", "30代", "-texture"],
    [3, "スポイトに液が残って最後まで使えない。", "스포이드에 액이 남아 끝까지 못 써요.", "混合肌", "30代", "-container"],
  ],
  "p-qes-05": [
    [2, "ぬるぬるして、なかなか乾かない。", "미끌거리고 좀처럼 마르지 않아요.", "脂性肌", "20代", "-texture"],
    [3, "保湿は一時的で、すぐ乾燥する。", "보습은 일시적이고 금방 건조해져요.", "乾燥肌", "30代", "-lasting_moisture"],
    [5, "安くてたっぷり使える。", "싸고 듬뿍 쓸 수 있어요.", "普通肌", "20代", "+value"],
  ],
  "p-qes-06": [
    [2, "香りがきつくて続けられなかった。", "향이 강해서 계속 못 썼어요.", "敏感肌", "20代", "-scent"],
    [1, "赤みが出てしまった。", "붉은기가 올라왔어요.", "敏感肌", "30代", "-irritation"],
    [3, "べたつきが残る。", "끈적임이 남아요.", "混合肌", "20代", "-texture"],
  ],
  "p-qes-07": [
    [2, "値段が高すぎる。量も少ない。", "가격이 너무 비싸요. 양도 적어요.", "普通肌", "40代", "-value"],
    [3, "少しべたつくので朝は使いにくい。", "조금 끈적여서 아침엔 쓰기 어려워요.", "混合肌", "30代", "-texture"],
    [4, "肌がふっくらする。", "피부가 도톰해지는 느낌이에요.", "乾燥肌", "40代", ""],
  ],
  "p-qes-08": [
    [2, "アルコールで肌がつっぱる。", "알코올 때문에 피부가 당겨요.", "乾燥肌", "30代", "-lasting_moisture"],
    [3, "ピリッとする刺激がある。", "따끔한 자극이 있어요.", "敏感肌", "20代", "-irritation"],
    [3, "スポイトが割れやすい。", "스포이드가 잘 깨져요.", "普通肌", "30代", "-container"],
  ],
  "p-qes-09": [
    [2, "発酵のにおいが苦手。", "발효 냄새가 싫어요.", "普通肌", "30代", "-scent"],
    [3, "さらっとしているけど、保湿が続かない。", "산뜻하지만 보습이 지속되지 않아요.", "乾燥肌", "20代", "+texture -lasting_moisture"],
    [5, "毎日使えるやさしさ。", "매일 쓸 수 있는 순함이에요.", "敏感肌", "30代", "+irritation"],
  ],
  "p-qes-10": [
    [1, "かゆみが出て使えなかった。", "가려워서 못 썼어요.", "敏感肌", "20代", "-irritation"],
    [2, "重めのテクスチャーでべたつく。", "무거운 제형이라 끈적여요.", "脂性肌", "20代", "-texture"],
    [3, "容量のわりに高い。", "용량에 비해 비싸요.", "混合肌", "30代", "-value"],
  ],
};

/** review-analyses.ts가 읽는 주제 태그 (리뷰 ID → "+topic -topic") */
export const reviewTopicSeeds: Record<string, string> = {};

const qoo10Rows = Object.entries(jaQoo10).flatMap(([productId, seeds], p) =>
  seeds.map(([rating, body, bodyKo, skin, age, tags], k) => {
    const id = `r-${productId.slice(2)}-${k + 1}`; // r-qsk-01-1
    reviewTopicSeeds[id] = tags;
    // 2026-08 ~ 2026-10 사이에 흩어 놓은 작성일
    const month = 8 + ((p + k) % 3);
    const day = 1 + ((p * 7 + k * 11) % 28);
    return {
      id,
      product_id: productId,
      source: "qoo10",
      external_id: `q10-${productId.slice(2)}-${k + 1}`,
      lang: "ja",
      rating,
      rating_scale: 5,
      body,
      body_ko: bodyKo,
      posted_at: ts(`2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`),
      reviewer_attrs: { skin_type: skin, age_group: age },
    };
  }),
);

for (const row of ko) reviewTopicSeeds[row[0]] = row[7];
for (const row of jaRakuten) reviewTopicSeeds[row[0]] = row[7];

export const reviews = parseAll(
  Review,
  [
    ...ko.map(([id, productId, rating, body, skin, age, date], i) => ({
      id,
      product_id: productId,
      source: "oliveyoung",
      external_id: `oy-${i + 1}`,
      lang: "ko",
      rating,
      rating_scale: 5,
      body,
      posted_at: ts(date),
      reviewer_attrs: { skin_type: skin, age_group: age },
    })),
    ...jaRakuten.map(([id, productId, rating, body, bodyKo, skin, age], i) => ({
      id,
      product_id: productId,
      source: "rakuten",
      external_id: `rk-${i + 1}`,
      lang: "ja",
      rating,
      rating_scale: 5,
      body,
      body_ko: bodyKo,
      posted_at: ts(`2026-10-1${i}`),
      reviewer_attrs: { skin_type: skin, age_group: age },
    })),
    ...qoo10Rows,
  ].map((r) => ({ raw: null, ...r, workspace_id: WORKSPACE_ID, created_at: r.posted_at })),
  "reviews",
);
