import { SnsPattern, SnsVideoNote } from "@/lib/schemas/market";
import { parseAll, ts, WORKSPACE_ID } from "./helpers";

// 일본 뷰티 영상 메모 (마케터 입력 샘플). 실제 영상·발화를 옮기지 않고 형식만 흉내 냈다. URL은 가짜 주소
// [id, 카테고리, 플랫폼, 제목, 메모(일본어), 메모(한국어), 광고 표시]
const NOTES: [string, string, SnsVideoNote["platform"], string, string, string, boolean][] = [
  ["sv-1", "化粧水", "tiktok", "乾燥肌が1か月使った化粧水レビュー", "「ベタつかないのにずっとしっとり」、コメントに「冬でもこれ1本」", "\"끈적이지 않는데 계속 촉촉\", 댓글에 \"겨울에도 이거 하나\"", false],
  ["sv-2", "化粧水", "youtube", "プチプラ化粧水5本比較", "最初に価格と容量を並べて1mLあたりを比較。「ベタつかないのに乾かない」", "처음에 가격과 용량을 나란히 놓고 mL당 비교. \"끈적이지 않는데 건조하지 않아\"", false],
  ["sv-3", "化粧水", "tiktok", "韓国トナーで肌がゆらがない話", "「重ねづけしてもベタつかない」、以前の高保湿化粧水はベタついて朝メイクが崩れたと話す", "\"덧발라도 끈적이지 않아\", 예전 고보습 화장수는 끈적여서 아침 화장이 무너졌다고 함", true],
  ["sv-4", "化粧水", "instagram", "朝のスキンケアルーティン", "冒頭で手の甲にのせてテクスチャを見せる。「水みたいなのにしっとり」", "초반에 손등에 올려 제형을 보여줌. \"물 같은데 촉촉\"", false],
  ["sv-5", "化粧水", "youtube", "敏感肌の化粧水選び", "最初に価格と容量を紹介。成分表を読み上げ、アルコールフリーかを確認", "처음에 가격과 용량 소개. 전성분을 읽고 알코올 프리인지 확인", false],
  ["sv-6", "美容液", "tiktok", "毛穴美容液3週間", "冒頭で使用前の肌を接写。「毛穴が目立たなくなった気がする」", "초반에 사용 전 피부를 접사. \"모공이 덜 보이는 것 같아\"", true],
  ["sv-7", "美容液", "youtube", "ナイアシンアミド美容液比較", "最初に配合成分の表記を並べて比べる。「ヒリヒリしない」", "처음에 배합 성분 표기를 나란히 비교. \"따끔거리지 않아\"", false],
  ["sv-8", "美容液", "instagram", "夜のスキンケア", "冒頭で使用前の肌を見せる。「翌朝の肌がなめらか」", "초반에 사용 전 피부를 보여줌. \"다음 날 아침 피부가 매끈\"", false],
  ["sv-9", "美容液", "tiktok", "レチノール初心者向け", "「ヒリヒリしない」、以前のレチノールで皮むけしたとコメント多数", "\"따끔거리지 않아\", 예전 레티놀로 각질이 일어났다는 댓글이 많음", false],
  ["sv-10", "クリーム", "youtube", "保湿クリーム冬の比較", "最初に容器ごと重さを量って容量を比較。「重いのにベタつかない」", "처음에 용기째 무게를 재 용량 비교. \"묵직한데 끈적이지 않아\"", false],
  ["sv-11", "クリーム", "tiktok", "敏感肌クリーム1本勝負", "「重いのにベタつかない」、以前のクリームは夜塗ると枕につくのが嫌だった", "\"묵직한데 끈적이지 않아\", 예전 크림은 밤에 바르면 베개에 묻어 싫었다고 함", true],
  ["sv-12", "クリーム", "instagram", "朝のメイク前クリーム", "冒頭でクリームを指にとって伸びを見せる", "초반에 크림을 손가락에 덜어 발림성을 보여줌", false],
];

export const snsVideoNotes = parseAll(
  SnsVideoNote,
  NOTES.map(([id, category, platform, title_ja, note_ja, note_ko, has_ad_label], i) => ({
    id,
    workspace_id: WORKSPACE_ID,
    created_at: ts("2026-10-20", `1${i % 10}:00`),
    category,
    platform,
    url: `https://example.jp/videos/${id}`,
    title_ja,
    note_ja,
    note_ko,
    has_ad_label,
    source: "marketer_input",
  })),
  "snsVideoNotes",
);

// 공통 패턴 (AI가 영상 메모를 묶었다고 가정한 샘플). 화면은 절반 이상의 영상에서 나온 패턴만 보여준다
// [id, 카테고리, 종류, 일본어 표현, 한국어, 영상, 관련 화면]
const PATTERNS: [string, string, SnsPattern["kind"], string | null, string, string[], string | null][] = [
  ["sp-1", "化粧水", "expression", "ベタつかないのに乾かない", "끈적이지 않는데 건조하지 않다", ["sv-1", "sv-2", "sv-3"], null],
  ["sp-2", "化粧水", "expression", "水みたいなのにしっとり", "물 같은데 촉촉하다", ["sv-4"], null],
  ["sp-3", "化粧水", "opening", null, "처음에 가격과 용량부터 비교한다", ["sv-2", "sv-5", "sv-4"], null],
  ["sp-4", "化粧水", "reason", null, "기존 고보습 제품의 끈적임 불만을 해결해서", ["sv-1", "sv-3", "sv-2"], "/reviews/compare"],
  ["sp-5", "美容液", "expression", "ヒリヒリしない", "따끔거리지 않는다", ["sv-7", "sv-9"], null],
  ["sp-6", "美容液", "opening", null, "처음에 사용 전 피부를 가까이 보여준다", ["sv-6", "sv-8"], null],
  ["sp-7", "美容液", "reason", null, "기존 고기능 성분 제품의 자극 불만을 해결해서", ["sv-9", "sv-7"], "/reviews/compare"],
  ["sp-8", "クリーム", "expression", "重いのにベタつかない", "묵직한데 끈적이지 않는다", ["sv-10", "sv-11"], null],
  ["sp-9", "クリーム", "opening", null, "처음에 제형·발림성을 보여준다", ["sv-12", "sv-11"], null],
  ["sp-10", "クリーム", "reason", null, "기존 보습 크림의 무거움·묻어남 불만을 해결해서", ["sv-11", "sv-10"], "/reviews/compare"],
];

export const snsPatterns = parseAll(
  SnsPattern,
  PATTERNS.map(([id, category, kind, label_ja, label_ko, video_ids, related_href]) => ({
    id,
    workspace_id: WORKSPACE_ID,
    created_at: ts("2026-10-21", "09:00"),
    category,
    kind,
    label_ja,
    label_ko,
    video_ids,
    related_href,
    model: "gpt-4.1-mini",
    prompt_version: "sns-patterns.v1 (샘플)",
    analyzed_at: ts("2026-10-21", "09:00"),
  })),
  "snsPatterns",
);
