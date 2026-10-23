import { SurveyProductLine, SurveyQuestion } from "@/lib/schemas/survey";
import { parseAll } from "./helpers";

// 문항·점수는 자체 기준 (설계 정리 문서). 일본어는 원어민 검수 전
// 점수 키: t = T존 유분, c = 볼 유분, d = 건조, s = 민감
export const surveyQuestions = parseAll(
  SurveyQuestion,
  [
    {
      id: "age",
      text_ja: "年齢をご選択ください。",
      options: [
        { value: "under18", label_ja: "17歳以下", is_under18: true },
        { value: "18-19", label_ja: "18〜19歳" },
        { value: "20s", label_ja: "20代" },
        { value: "30s", label_ja: "30代" },
        { value: "40s", label_ja: "40代" },
        { value: "50plus", label_ja: "50代以上" },
      ],
    },
    {
      id: "after_wash",
      text_ja: "洗顔後、何もつけずに30分たつと、顔はどう感じますか？",
      options: [
        { value: "all_tight", label_ja: "顔全体がつっぱり、笑ったり表情を動かしたりすると気になる", score: { d: 3 } },
        { value: "part_tight", label_ja: "頬や口元など一部だけつっぱる", score: { d: 2 } },
        { value: "brief_tight", label_ja: "はじめは少しつっぱるが、すぐに気にならなくなる", score: { d: 1 } },
        { value: "none", label_ja: "つっぱり感はない" },
      ],
    },
    {
      id: "t_zone",
      text_ja: "朝の洗顔から4〜5時間たったころ、おでこと鼻（Tゾーン）を指でさわるとどうですか？",
      options: [
        { value: "oily_visible", label_ja: "指に皮脂がつき、テカリが目に見える", score: { t: 3 } },
        { value: "oily_little", label_ja: "指に皮脂が少しつく", score: { t: 2 } },
        { value: "glow", label_ja: "ツヤはあるが、指にはつかない", score: { t: 1 } },
        { value: "dry", label_ja: "さらっとしている、または乾燥している" },
      ],
    },
    {
      id: "cheek",
      text_ja: "同じころ（洗顔から4〜5時間後）、頬を指でさわるとどうですか？",
      options: [
        { value: "oily", label_ja: "指に皮脂がつく", score: { c: 3 } },
        { value: "moist", label_ja: "しっとりしてなめらか", score: { c: 1 } },
        { value: "smooth", label_ja: "さらっとしていて、つっぱらない" },
        { value: "rough", label_ja: "ごわつく、または角質がざらつく", score: { d: 2 } },
      ],
    },
    {
      id: "pores",
      text_ja: "鏡から30cmほど離れて見たとき、毛穴が見えるのはどこですか？",
      options: [
        { value: "cheek", label_ja: "鼻だけでなく頬まで見える", score: { c: 2 } },
        { value: "nose", label_ja: "鼻とそのまわりだけ見える", score: { t: 1 } },
        { value: "none", label_ja: "ほとんど見えない" },
      ],
    },
    {
      id: "moisturizer",
      text_ja: "エアコンの効いた室内や冬に、保湿剤を塗ったあとの肌はどうですか？",
      options: [
        { value: "tight_again", label_ja: "塗っても数時間でまたつっぱる、または粉をふく", score: { d: 3 } },
        { value: "fine", label_ja: "塗れば一日中気にならない", score: { d: 1 } },
        { value: "no_need", label_ja: "保湿剤を塗らなくても気にならない" },
      ],
    },
    {
      id: "blotting",
      text_ja: "1日にあぶらとり紙やティッシュで顔の皮脂をおさえる回数は？",
      options: [
        { value: "2plus", label_ja: "2回以上", score: { t: 2 } },
        { value: "1", label_ja: "1回", score: { t: 1 } },
        { value: "0", label_ja: "おさえない（必要がない）" },
      ],
    },
    {
      id: "new_product",
      text_ja: "新しい基礎化粧品（化粧水・クリームなど）を初めて使ったとき、ヒリヒリ・赤み・かゆみが出たことはありますか？",
      options: [
        { value: "always", label_ja: "新しい製品を使うたびにほとんど出る", score: { s: 3 } },
        { value: "this_year", label_ja: "この1年で2回以上出た", score: { s: 2 } },
        { value: "long_ago", label_ja: "1年以上前に1〜2回あった", score: { s: 1 } },
        { value: "never", label_ja: "一度もない" },
      ],
    },
    {
      id: "triggers",
      text_ja: "肌が赤くなったり、かゆくなったりしたことがある場面をすべてお選びください。",
      multi: true,
      count_score: { key: "s", max: 2 },
      options: [
        { value: "season", label_ja: "季節の変わり目" },
        { value: "pollen", label_ja: "花粉の時期" },
        { value: "mask", label_ja: "マスクを長時間つけたとき" },
        { value: "sun", label_ja: "日差しを浴びたあと" },
        { value: "sweat", label_ja: "汗をかいたあと" },
        { value: "none", label_ja: "あてはまらない", is_none: true },
      ],
    },
    {
      id: "concerns",
      text_ja: "気になる肌の悩みをお選びください。",
      multi: true,
      options: [
        { value: "dryness", label_ja: "乾燥・つっぱり" },
        { value: "shine", label_ja: "テカリ・毛穴" },
        { value: "acne", label_ja: "ニキビ・肌あれ" },
        { value: "dullness", label_ja: "くすみ" },
        { value: "redness", label_ja: "赤み・刺激" },
        { value: "firmness", label_ja: "ハリ・小じわ" },
        { value: "other", label_ja: "その他（自由記入）", is_other: true },
      ],
    },
  ],
  "surveyQuestions",
);

// 제품명은 가칭. 추천 문구는 약기법 검토 전 (광고 검토 담당과 합칠 예정)
export const surveyProductLines = parseAll(
  SurveyProductLine,
  [
    {
      id: "moisture-skin",
      name_ja: "Leaf& モイスチャースキン（仮称）",
      name_ko: "Leaf& 모이스처 스킨",
      ingredients_ja: "ヒアルロン酸・グリセリン・パンテノール",
      status: "on_sale",
      // 중성: 팀 결정(2026-10-23)으로 건성 라인 스킨 + 지성 라인(출시 알림)
      for_types: ["dry", "inner_dry", "normal"],
    },
    {
      id: "moisture-essence",
      name_ja: "Leaf& モイスチャーエッセンス（仮称）",
      name_ko: "Leaf& 모이스처 에센스",
      ingredients_ja: "ヒアルロン酸・セラミド・コレステロール・脂肪酸",
      status: "on_sale",
      for_types: ["dry", "inner_dry"],
    },
    {
      id: "combo-line",
      name_ja: "Leaf& 混合肌ライン（仮称）",
      name_ko: "Leaf& 복합성 라인",
      ingredients_ja: "ヒアルロン酸・グリセリン・ベタイン",
      status: "in_development",
      for_types: ["combo", "inner_dry"],
    },
    {
      id: "oily-line",
      name_ja: "Leaf& 脂性肌ライン（仮称）",
      name_ko: "Leaf& 지성 라인",
      ingredients_ja: "ヒアルロン酸・パンテノール・緑茶エキス",
      status: "in_development",
      for_types: ["oily", "normal"],
    },
  ],
  "surveyProductLines",
);

// 응답 집계(surveySummary)는 더미 응답에서 계산한다: ./survey-responses.ts
