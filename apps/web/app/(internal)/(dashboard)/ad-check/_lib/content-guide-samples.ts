// 콘텐츠 제작 가이드 샘플 (가짜 데이터). 실제 AI 출력이 아니다.
// 채널 4개(상세페이지(큐텐)·인스타그램·X·배너)마다 제목 3개. 제목·블록마다 첫 번째 안이 「가장 추천」이다.
// {product} 자리에 화면이 제품 이름을 넣는다. 문구는 효능 범위 안의 표현(보습·사용감)만 쓰고, 게시 전에는 새 검토로 다시 확인한다.
// 상세페이지 블록 구성은 Qoo10 상세페이지 분석 전의 가설이다 (분석 후 고친다).
import { z } from "zod";

export const GUIDE_CHANNELS = [
  { id: "qoo10_detail", label: "상세페이지(큐텐)" },
  { id: "instagram", label: "인스타그램" },
  { id: "x", label: "X" },
  { id: "banner", label: "배너" },
] as const;
export const GuideChannel = z.enum(["qoo10_detail", "instagram", "x", "banner"]);
export type GuideChannel = z.infer<typeof GuideChannel>;

/** X 게시글 글자 수 기준 (일본어는 한 글자를 2로 세어 280, 즉 약 140자) */
export const X_CHAR_LIMIT = 140;

const Copy = z.object({ text_ja: z.string(), text_ko: z.string() });

export const GuideBlock = z.object({
  key: z.string(),
  heading: z.string(),
  /** 첫 번째가 가장 추천, 두 번째가 다른 안 */
  options: z.array(Copy).min(1).max(2),
  /** 첫 번째 안을 추천하는 이유 */
  reason: z.string(),
  has_image: z.boolean(),
  /** 리뷰가 있어야 쓸 수 있는 블록. 리뷰 없는 제품(개발 중)에서는 뺀다 */
  needs_reviews: z.boolean().default(false),
});
export type GuideBlock = z.infer<typeof GuideBlock>;

export const GuideDraft = z.object({
  id: z.string(),
  channel: GuideChannel,
  title_ja: z.string(),
  title_ko: z.string(),
  /** 채널마다 하나만 true. 목록 맨 앞에 둔다 */
  recommended: z.boolean(),
  /** 이 제목을 추천하는(또는 고를 때 참고할) 이유 */
  reason: z.string(),
  blocks: z.array(GuideBlock),
  hashtags: z.array(z.string()).default([]),
  /** AI에 넣을 프롬프트 가이드 (한국어) */
  prompt_guide: z.string(),
});
export type GuideDraft = z.infer<typeof GuideDraft>;

const c = (text_ja: string, text_ko: string) => ({ text_ja, text_ko });

// 상세페이지 공통 블록 (고민 제기 ~ 제품 정보). 제목마다 메인 비주얼·소구점만 바꾼다
const DETAIL_COMMON = [
  {
    key: "concern",
    heading: "고민 제기",
    options: [c("乾燥が気になる季節、毎日のケアに迷っていませんか。", "건조함이 신경 쓰이는 계절, 매일의 케어에 고민하고 있지 않나요?"), c("洗顔後、すぐにつっぱる感じがする方へ。", "세안 후 금방 당기는 느낌이 드는 분께.")],
    reason: "피부 질환이 아니라 「건조함이 신경 쓰인다」는 사용 장면으로 고민을 꺼내 치료로 읽히지 않아요.",
    has_image: false,
  },
  {
    key: "ingredient",
    heading: "성분",
    options: [c("保湿成分：ヒアルロン酸Na・グリセリン配合", "보습 성분: 히알루론산Na·글리세린 배합"), c("うるおいを与えるヒアルロン酸Na（保湿成分）", "수분을 주는 히알루론산Na(보습 성분)")],
    reason: "성분을 내세울 때 배합 목적(保湿成分)을 함께 적어야 해요 (F5.5). 첫 번째 안이 목적을 앞에 둬서 더 분명해요.",
    has_image: true,
  },
  {
    key: "texture",
    heading: "사용감·제형",
    options: [c("みずみずしく、べたつかないテクスチャー。", "촉촉하고 끈적이지 않는 제형."), c("さらっとなじんで、重ねづけもしやすい。", "산뜻하게 스며들어 여러 번 덧발라도 좋아요.")],
    reason: "리뷰 소구점 「산뜻한 흡수」을 그대로 사용감 문구로 옮겼어요.",
    has_image: true,
  },
  {
    key: "howto",
    heading: "사용법",
    options: [c("洗顔後、適量を手に取り顔全体になじませてください。", "세안 후 적당량을 덜어 얼굴 전체에 발라 주세요."), c("コットンでも、手のひらでもお使いいただけます。", "화장솜으로도 손으로도 쓸 수 있어요.")],
    reason: "사용 방법은 효능을 말하지 않아 위험이 낮아요. 첫 번째 안이 순서가 분명해요.",
    has_image: false,
  },
  {
    key: "review",
    heading: "리뷰",
    options: [c("「しっとりするのにべたつかない」", "「촉촉한데 끈적이지 않아요」"), c("「香りが控えめで毎日使いやすい」", "「향이 은은해서 매일 쓰기 좋아요」")],
    reason: "사용감 후기만 골랐어요. 「트러블이 사라졌다」 같은 체험담은 효능 표현으로 봐서 빼요.",
    has_image: false,
    needs_reviews: true,
  },
  {
    key: "for_whom",
    heading: "추천 대상",
    options: [c("こんな方に：乾燥が気になる方・べたつきが苦手な方", "이런 분께: 건조함이 신경 쓰이는 분·끈적임이 싫은 분"), c("朝のメイク前のスキンケアに。", "아침 메이크업 전 스킨케어로.")],
    reason: "피부 질환 이름 대신 취향과 사용 장면으로 대상을 적었어요.",
    has_image: false,
  },
  {
    key: "info",
    heading: "제품 정보",
    options: [c("内容量・全成分・使用上の注意は商品情報欄をご確認ください。", "용량·전성분·사용상 주의는 상품 정보란을 확인해 주세요.")],
    reason: "전성분과 주의사항은 표시 의무 항목이라 빠짐없이 둬요.",
    has_image: false,
  },
];

const detailDraft = (id: string, recommended: boolean, title: [string, string], reason: string, hero: [string, string][], points: [string, string][], prompt: string) => ({
  id,
  channel: "qoo10_detail",
  title_ja: title[0],
  title_ko: title[1],
  recommended,
  reason,
  blocks: [
    { key: "hero", heading: "메인 비주얼", options: hero.map(([ja, ko]) => c(ja, ko)), reason: "리뷰 소구점 1위 「오래가는 보습」을 캐치카피에 담았어요. 검색어 상위가 「韓国 化粧水」 계열이라 상품명 옆에 「化粧水」를 함께 쓰는 걸 권해요.", has_image: true },
    DETAIL_COMMON[0],
    { key: "points", heading: "소구점 3가지", options: points.map(([ja, ko]) => c(ja, ko)), reason: "리뷰 소구점(보습감·사용감)을 효능 범위 안의 표현으로 정리했어요.", has_image: true },
    ...DETAIL_COMMON.slice(1),
  ],
  prompt_guide: prompt,
});

const DETAIL_PROMPT =
  "Qoo10 상세페이지 문구를 일본어로 써 줘. 블록 순서는 메인 비주얼 → 고민 제기 → 소구점 3가지 → 성분 → 사용감 → 사용법 → 리뷰 → 추천 대상 → 제품 정보. 블록마다 안을 2개 내고 첫 번째에 추천 이유를 붙여. 효능은 화장품 효능 범위 56항목 안(보습·피부결 정돈)만, 성분은 배합 목적(保湿成分 등)과 함께, 침투 표현은 「角質層まで」로만. 리뷰는 사용감 후기만 쓰고, 리뷰가 없는 제품은 리뷰 블록을 빼.";

const RAW: unknown[] = [
  detailDraft(
    "dp-1",
    true,
    ["毎日のうるおいを、角質層まで", "매일의 수분을, 각질층까지"],
    "리뷰 소구점 1위 「오래가는 보습」을 제목에 담았어요. 「角質層まで」로 침투 범위를 밝혀 약기법에도 맞아요.",
    [["{product}\n毎日のうるおいを、角質層まで。", "{product}\n매일의 수분을, 각질층까지."], ["{product}\nしっとり続く、毎日の保湿ケア。", "{product}\n촉촉함이 이어지는 매일의 보습 케어."]],
    [["① 角質層までうるおう ② べたつかない ③ 毎日使いやすい", "① 각질층까지 촉촉 ② 끈적이지 않음 ③ 매일 쓰기 쉬움"], ["① しっとり ② さらっと ③ 香り控えめ", "① 촉촉 ② 산뜻 ③ 은은한 향"]],
    DETAIL_PROMPT,
  ),
  detailDraft(
    "dp-2",
    false,
    ["肌のキメを整える、しっとりローション", "피부결을 정돈하는 촉촉한 로션"],
    "「キメを整える」는 효능 범위 안의 표현이에요. 다만 검색어와의 연결은 1번보다 약해요.",
    [["{product}\n肌のキメを整える、しっとりローション。", "{product}\n피부결을 정돈하는 촉촉한 로션."], ["{product}\nなめらかな肌へ、毎日のひと手間。", "{product}\n매끄러운 피부로, 매일의 한 단계."]],
    [["① キメを整える ② しっとり ③ なじみやすい", "① 피부결 정돈 ② 촉촉 ③ 잘 스며듦"], ["① 洗顔後すぐ ② 朝晩使える ③ べたつかない", "① 세안 직후 ② 아침저녁 ③ 끈적이지 않음"]],
    DETAIL_PROMPT,
  ),
  detailDraft(
    "dp-3",
    false,
    ["乾燥が気になる日の、うるおい習慣", "건조함이 신경 쓰이는 날의 보습 습관"],
    "사용 장면이 분명해 공감을 얻기 좋아요. 제목에 제품 특징이 적어서 2번보다 뒤에 뒀어요.",
    [["{product}\n乾燥が気になる日の、うるおい習慣。", "{product}\n건조함이 신경 쓰이는 날의 보습 습관."], ["{product}\n季節の変わり目も、しっとり。", "{product}\n환절기에도 촉촉하게."]],
    [["① 乾燥する日に ② 朝晩のケアに ③ 重ねづけOK", "① 건조한 날에 ② 아침저녁 케어에 ③ 덧바르기 OK"], ["① しっとり ② やさしい使い心地 ③ 毎日続けやすい", "① 촉촉 ② 부드러운 사용감 ③ 매일 이어 쓰기 쉬움"]],
    DETAIL_PROMPT,
  ),
  // 인스타그램
  {
    id: "ig-1",
    channel: "instagram",
    title_ja: "#うるおい習慣 はじめませんか",
    title_ko: "#보습습관 시작해 볼까요",
    recommended: true,
    reason: "리뷰 소구점 「산뜻한 흡수」를 첫 줄에 담고, #韓国コスメ 태그로 검색어 상위 「韓国 化粧水」 계열과 맞췄어요.",
    blocks: [
      { key: "image", heading: "사진", options: [c("洗顔後のスキンケアシーン", "세안 후 스킨케어 장면")], reason: "제품을 쓰는 장면이 효능 약속 없이 사용감을 보여 줘요.", has_image: true },
      {
        key: "caption",
        heading: "캡션",
        options: [c("洗顔後のひと手間で、しっとり。\nべたつかないから、朝のメイク前にも。\n{product}", "세안 후 한 단계로 촉촉하게.\n끈적이지 않아서 아침 메이크업 전에도.\n{product}"), c("毎日のうるおいケアに、{product}。", "매일의 보습 케어에 {product}.")],
        reason: "첫 줄에 사용 장면, 둘째 줄에 리뷰 소구점을 둬서 피드에서 바로 읽혀요.",
        has_image: false,
      },
    ],
    hashtags: ["#保湿", "#スキンケア", "#韓国コスメ"],
    prompt_guide: "인스타그램 캡션을 일본어로 3줄 이내로 써 줘. 해시태그는 3개 이내. 효능은 보습·사용감만, 「絶対」「必ず」 같은 보증과 의사·전문가 추천은 쓰지 마. 협찬 게시물이면 PR 표기를 넣어(스텔스 마케팅 규제).",
  },
  {
    id: "ig-2",
    channel: "instagram",
    title_ja: "朝のスキンケア、これひとつ",
    title_ko: "아침 스킨케어, 이거 하나",
    recommended: false,
    reason: "사용 장면이 분명하지만 검색어와 연결이 약해요.",
    blocks: [
      { key: "image", heading: "사진", options: [c("朝の洗面台とボトル", "아침 세면대와 제품")], reason: "아침 루틴 장면이에요.", has_image: true },
      { key: "caption", heading: "캡션", options: [c("朝のスキンケアに {product}。さっぱりなのに、しっとり。", "아침 스킨케어에 {product}. 산뜻한데 촉촉하게."), c("メイク前にもなじみやすい、軽いテクスチャー。", "메이크업 전에도 잘 스며드는 가벼운 제형.")], reason: "제형을 구체적으로 묘사했어요.", has_image: false },
    ],
    hashtags: ["#朝スキンケア", "#保湿"],
    prompt_guide: "인스타그램 캡션을 일본어로 써 줘. 사용 장면 하나(아침)에 집중하고 제형을 구체적으로 묘사해.",
  },
  {
    id: "ig-3",
    channel: "instagram",
    title_ja: "乾燥する季節の、わたしの定番",
    title_ko: "건조한 계절의 나의 단골템",
    recommended: false,
    reason: "계절감이 좋지만 「定番」은 순위처럼 읽히지 않게 주의가 필요해요.",
    blocks: [
      { key: "image", heading: "사진", options: [c("冬のデスクとボトル", "겨울 책상과 제품")], reason: "계절 분위기를 보여 줘요.", has_image: true },
      { key: "caption", heading: "캡션", options: [c("乾燥する季節の定番に、{product}。", "건조한 계절의 단골템으로 {product}."), c("季節の変わり目も、うるおいケアを続けたい方に。", "환절기에도 보습 케어를 이어 가고 싶은 분께.")], reason: "「肌荒れが治る」처럼 치료로 읽히는 말 없이 계절감만 담았어요.", has_image: false },
    ],
    hashtags: ["#乾燥対策", "#保湿ケア"],
    prompt_guide: "인스타그램 캡션을 일본어로 써 줘. 계절감을 넣되 치료로 읽히는 말은 쓰지 마.",
  },
  // X
  {
    id: "x-1",
    channel: "x",
    title_ja: "べたつかない保湿、試してみて",
    title_ko: "끈적이지 않는 보습, 써 보세요",
    recommended: true,
    reason: "리뷰 소구점 「산뜻한 흡수」이 첫머리에 와서 타임라인에서 바로 눈에 띄어요. 140자 안에 들어가요.",
    blocks: [
      {
        key: "post",
        heading: "게시글",
        options: [c("べたつかないのに、しっとり。\n洗顔後すぐになじむ {product}。\n毎日のうるおいケアに。#保湿", "끈적이지 않는데 촉촉하게.\n세안 후 바로 스며드는 {product}.\n매일의 보습 케어에. #보습"), c("乾燥が気になる季節の保湿ケアに {product}。#スキンケア", "건조함이 신경 쓰이는 계절의 보습 케어에 {product}. #스킨케어")],
        reason: "짧은 문장 3줄로 끊어 읽기 쉬워요. 해시태그는 1개로 줄였어요.",
        has_image: false,
      },
      { key: "image", heading: "이미지", options: [c("テクスチャーのアップ", "제형 클로즈업")], reason: "글만으로 전하기 어려운 사용감을 보여 줘요.", has_image: true },
    ],
    hashtags: ["#保湿"],
    prompt_guide: "X 게시글을 일본어로 140자 이내로 써 줘. 첫 줄에 소구점, 해시태그는 1~2개. 효능 보증·최상급·의사 추천은 쓰지 마.",
  },
  {
    id: "x-2",
    channel: "x",
    title_ja: "朝の1本",
    title_ko: "아침의 한 병",
    recommended: false,
    reason: "짧고 인상적이지만 무엇이 좋은지가 덜 드러나요.",
    blocks: [
      { key: "post", heading: "게시글", options: [c("朝のスキンケアは {product} 1本から。さっぱり、しっとり。", "아침 스킨케어는 {product} 한 병부터. 산뜻하게, 촉촉하게."), c("メイク前にもなじむ軽さ。{product}", "메이크업 전에도 스며드는 가벼움. {product}")], reason: "사용 장면 하나로 짧게 썼어요.", has_image: false },
      { key: "image", heading: "이미지", options: [c("朝の洗面台", "아침 세면대")], reason: "아침 장면이에요.", has_image: true },
    ],
    prompt_guide: "X 게시글을 일본어로 짧게 써 줘. 사용 장면 하나에 집중해.",
  },
  {
    id: "x-3",
    channel: "x",
    title_ja: "季節の変わり目に",
    title_ko: "환절기에",
    recommended: false,
    reason: "계절 이슈와 맞지만 제품 특징이 적어요.",
    blocks: [
      { key: "post", heading: "게시글", options: [c("季節の変わり目は、うるおいケアを丁寧に。{product}", "환절기에는 보습 케어를 꼼꼼하게. {product}"), c("乾燥が気になったら、{product}。", "건조함이 신경 쓰이면 {product}.")], reason: "계절과 보습을 연결했어요.", has_image: false },
      { key: "image", heading: "이미지", options: [c("季節の風景と製品", "계절 풍경과 제품")], reason: "계절감을 보여 줘요.", has_image: true },
    ],
    prompt_guide: "X 게시글을 일본어로 써 줘. 계절감을 넣되 치료로 읽히는 말은 쓰지 마.",
  },
  // 배너 (가로형 한 종류, 어느 배너 광고에도 쓸 수 있게)
  {
    id: "bn-1",
    channel: "banner",
    title_ja: "角質層まで、うるおう。",
    title_ko: "각질층까지 촉촉하게.",
    recommended: true,
    reason: "짧고 효능 범위 안의 표현이에요. 리뷰 소구점 「오래가는 보습」과도 맞아요.",
    blocks: [
      { key: "copy", heading: "메인 카피", options: [c("角質層まで、うるおう。", "각질층까지 촉촉하게."), c("毎日の、しっとり。", "매일의 촉촉함.")], reason: "15자 안팎이라 어떤 배너 크기에도 들어가요.", has_image: true },
      { key: "sub", heading: "서브 카피", options: [c("{product}", "{product}"), c("{product}｜保湿ローション", "{product}｜보습 로션")], reason: "제품 이름만 두어 배너가 복잡해지지 않아요.", has_image: false },
    ],
    prompt_guide: "가로형 배너 문구를 일본어로 써 줘. 메인 카피 15자 안팎 + 서브 카피(제품명). 순위·최상급, 「今だけ」 같은 근거 없는 한정, 기간 약속은 쓰지 마.",
  },
  {
    id: "bn-2",
    channel: "banner",
    title_ja: "毎日の、しっとり。",
    title_ko: "매일의 촉촉함.",
    recommended: false,
    reason: "가장 짧지만 제품 특징이 덜 드러나요.",
    blocks: [
      { key: "copy", heading: "메인 카피", options: [c("毎日の、しっとり。", "매일의 촉촉함."), c("しっとり、毎日。", "촉촉하게, 매일.")], reason: "사용감 한 단어가 중심이에요.", has_image: true },
      { key: "sub", heading: "서브 카피", options: [c("{product}", "{product}")], reason: "제품 이름만 둬요.", has_image: false },
    ],
    prompt_guide: "가로형 배너 문구를 일본어로 짧게 써 줘. 사용감 한 단어를 중심에 둬.",
  },
  {
    id: "bn-3",
    channel: "banner",
    title_ja: "キメを整える、うるおいケア",
    title_ko: "피부결을 정돈하는 보습 케어",
    recommended: false,
    reason: "효능 범위 안이지만 배너로는 조금 길어요.",
    blocks: [
      { key: "copy", heading: "메인 카피", options: [c("キメを整える、うるおいケア。", "피부결을 정돈하는 보습 케어."), c("なめらかな肌へ。", "매끄러운 피부로.")], reason: "효능 범위 표현(キメを整える)을 그대로 썼어요.", has_image: true },
      { key: "sub", heading: "서브 카피", options: [c("{product}", "{product}")], reason: "제품 이름만 둬요.", has_image: false },
    ],
    prompt_guide: "가로형 배너 문구를 일본어로 써 줘. 효능 범위 안의 표현 하나만 써.",
  },
];

/** 불러올 때 Zod로 검증한다 */
export const GUIDE_DRAFTS: GuideDraft[] = z.array(GuideDraft).parse(RAW);

/** {product} 자리에 제품 이름을 넣는다 */
export function fillProduct(text: string, productName: string): string {
  return text.replaceAll("{product}", productName);
}
