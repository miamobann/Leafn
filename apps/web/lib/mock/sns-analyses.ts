import { SnsTrendAnalysisRow, type SnsAnalysisVideo } from "@/lib/schemas/market";
import { parseAll, ts, WORKSPACE_ID } from "./helpers";

// SNS 영상 분석 결과 샘플 (sns_trend_analyses 모양, 2026-10-26). 실제 영상·발화를 옮기지 않고 형식만 흉내 냈다.
// 영상 주소는 가짜 계정(@leafn_sample)이고, 캡션·자막은 지어낸 짧은 문장이다

/** [작성자, 캡션, 발화 자막, 조회, 좋아요, 저장, 광고 표시, 메모] */
type V = [string, string, string | null, number, number, number, boolean, string];

function videos(list: V[], offset: number): SnsAnalysisVideo[] {
  return list.map(([author, caption, transcript, play, like, save, ad, memo], i) => ({
    index: i + 1,
    url: `https://www.tiktok.com/@leafn_sample/video/74000000000000000${String(offset + i).padStart(2, "0")}`,
    author,
    caption,
    hashtags: caption.match(/#\S+/g)?.map((h) => h.slice(1)) ?? [],
    transcript,
    play_count: play,
    like_count: like,
    save_count: save,
    is_ad: ad,
    posted_at: ts("2026-10-1" + (i % 9), "20:00"),
    error: null,
    memo,
  }));
}

const TONER: V[] = [
  ["sample_skin_a", "乾燥肌が1か月使った化粧水 #化粧水 #乾燥肌", "ベタつかないのにずっとしっとりしてる", 182000, 9100, 2400, false, ""],
  ["sample_skin_b", "プチプラ化粧水5本比較 #コスパ", "1mLあたりで比べるとこれが一番。ベタつかないのに乾かない", 96000, 4100, 3800, false, "가격·용량부터 비교"],
  ["sample_skin_c", "韓国トナーで肌がゆらがない #韓国スキンケア #PR", "重ねづけしてもベタつかない", 240000, 15000, 5200, true, ""],
  ["sample_skin_d", "朝のスキンケアルーティン #朝スキンケア", "水みたいなのにしっとり。メイク前でもヨレない", 51000, 2300, 900, false, ""],
  ["sample_skin_e", "敏感肌の化粧水選び #敏感肌", "アルコールフリーで刺激がないか成分表を見る", 73000, 3600, 2100, false, ""],
];

const SERUM: V[] = [
  ["sample_skin_f", "毛穴美容液3週間 #毛穴ケア #PR", "毛穴が目立たなくなった気がする", 130000, 7200, 3100, true, ""],
  ["sample_skin_g", "ナイアシンアミド美容液比較 #ナイアシンアミド", "ヒリヒリしないのがいちばん大事", 88000, 4000, 2600, false, ""],
  ["sample_skin_h", "夜のスキンケア #夜スキンケア", "翌朝の肌がなめらか", 42000, 1900, 700, false, ""],
  ["sample_skin_i", "レチノール初心者向け #レチノール", "前のレチノールは皮むけしたけどこれはヒリヒリしない", 150000, 8800, 4400, false, "자극 없는 레티놀 문맥"],
];

const ROWS = [
  {
    id: "sns-1",
    category: "化粧水",
    videos: videos(TONER, 0),
    result: {
      needs: [
        {
          need_ko: "끈적이지 않는 보습",
          summary_ko: "촉촉함은 원하지만 바른 뒤 끈적임·화장 무너짐은 싫다",
          keywords: [
            { keyword_ja: "ベタつかない", keyword_ko: "끈적이지 않는", videos: [1, 2, 3] },
            { keyword_ja: "しっとり", keyword_ko: "촉촉", videos: [1, 4] },
          ],
          videos: [1, 2, 3, 4],
          views: 569000,
          evidence: [
            { video: 1, quote_ja: "ベタつかないのにずっとしっとりしてる" },
            { video: 3, quote_ja: "重ねづけしてもベタつかない" },
          ],
        },
        {
          need_ko: "가성비 (mL당 가격)",
          summary_ko: "가격과 용량을 나란히 놓고 mL당으로 비교한다",
          keywords: [{ keyword_ja: "コスパ", keyword_ko: "가성비", videos: [2] }, { keyword_ja: "1mLあたり", keyword_ko: "mL당", videos: [2] }],
          videos: [2],
          views: 96000,
          evidence: [{ video: 2, quote_ja: "1mLあたりで比べるとこれが一番" }],
        },
        {
          need_ko: "저자극 (알코올 프리)",
          summary_ko: "민감 피부는 성분표에서 알코올 유무부터 본다",
          keywords: [{ keyword_ja: "アルコールフリー", keyword_ko: "알코올 프리", videos: [5] }],
          videos: [5],
          views: 73000,
          evidence: [{ video: 5, quote_ja: "アルコールフリーで刺激がないか成分表を見る" }],
        },
      ],
      keywords: [
        { keyword_ja: "ベタつかない", keyword_ko: "끈적이지 않는", videos: [1, 2, 3], need_ko: "끈적이지 않는 보습" },
        { keyword_ja: "しっとり", keyword_ko: "촉촉", videos: [1, 4], need_ko: "끈적이지 않는 보습" },
        { keyword_ja: "コスパ", keyword_ko: "가성비", videos: [2], need_ko: "가성비 (mL당 가격)" },
        { keyword_ja: "アルコールフリー", keyword_ko: "알코올 프리", videos: [5], need_ko: "저자극 (알코올 프리)" },
      ],
      dropped: 0,
      analyzed_at: ts("2026-10-21", "09:00"),
    },
  },
  {
    id: "sns-2",
    category: "美容液",
    videos: videos(SERUM, 10),
    result: {
      needs: [
        {
          need_ko: "따끔거리지 않는 고기능",
          summary_ko: "레티놀·나이아신아마이드를 쓰고 싶지만 자극은 피하고 싶다",
          keywords: [{ keyword_ja: "ヒリヒリしない", keyword_ko: "따끔거리지 않는", videos: [2, 4] }],
          videos: [2, 4],
          views: 238000,
          evidence: [
            { video: 2, quote_ja: "ヒリヒリしないのがいちばん大事" },
            { video: 4, quote_ja: "前のレチノールは皮むけしたけどこれはヒリヒリしない" },
          ],
        },
        {
          need_ko: "모공이 덜 보이는 피부",
          summary_ko: "사용 전후 피부 결·모공 변화를 가까이 보여 준다",
          keywords: [{ keyword_ja: "毛穴", keyword_ko: "모공", videos: [1] }],
          videos: [1],
          views: 130000,
          evidence: [{ video: 1, quote_ja: "毛穴が目立たなくなった気がする" }],
        },
      ],
      keywords: [
        { keyword_ja: "ヒリヒリしない", keyword_ko: "따끔거리지 않는", videos: [2, 4], need_ko: "따끔거리지 않는 고기능" },
        { keyword_ja: "毛穴", keyword_ko: "모공", videos: [1], need_ko: "모공이 덜 보이는 피부" },
      ],
      dropped: 0,
      analyzed_at: ts("2026-10-21", "09:30"),
    },
  },
];

export const snsAnalyses = parseAll(
  SnsTrendAnalysisRow,
  ROWS.map((r) => ({ ...r, workspace_id: WORKSPACE_ID, created_at: r.result.analyzed_at, created_by: null, model: "gpt-4.1-mini", prompt_version: "sns-trends.v1 (샘플)" })),
  "snsAnalyses",
);
