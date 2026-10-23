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

/** X 게시글 글자 수 기준 (일본어는 한 글자를 2로 세어 280, 즉 약 140자). 권장은 100~130자 */
export const X_CHAR_LIMIT = 140;
export const X_CHAR_RECOMMENDED = 130;
/** X 해시태그는 3개를 넘으면 노출이 줄어든다 */
export const X_MAX_HASHTAGS = 3;

const Copy = z.object({ text_ja: z.string(), text_ko: z.string() });

export const POST_TYPES = [
  { id: "general", label: "일반 게시물" },
  { id: "campaign", label: "캠페인 게시물 (프로모션·시즌)" },
] as const;
export type PostType = (typeof POST_TYPES)[number]["id"];

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
  /** 인스타그램·X의 게시물 종류. 캠페인은 프로모션(メガ割 등)·시즌 테마 */
  post_type: z.enum(["general", "campaign"]).default("general"),
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

/** 인스타그램 캐러셀 최대 장 수 */
export const IG_MAX_SLIDES = 5;

const igDraft = (
  id: string,
  recommended: boolean,
  title: [string, string],
  reason: string,
  slides: [string, string][],
  caption: [string, string],
  hashtags: string[],
  post_type: PostType = "general",
) => ({
  id,
  channel: "instagram",
  post_type,
  title_ja: title[0],
  title_ko: title[1],
  recommended,
  reason,
  blocks: [
    ...slides.slice(0, IG_MAX_SLIDES).map(([ja, ko], i) => ({
      key: `slide${i + 1}`,
      heading: `슬라이드 ${i + 1}${["커버", "고민", "제형", "사용법", "마무리"][i] ? ` · ${["커버", "고민", "제형", "사용법", "마무리"][i]}` : ""}`,
      options: [c(ja, ko)],
      reason: i === 0 ? "커버는 2줄 이내 훅으로 스크롤을 멈추게 해요." : "슬라이드마다 한 가지 메시지만 담았어요.",
      has_image: true,
    })),
    { key: "caption", heading: "캡션", options: [c(caption[0], caption[1])], reason: "훅 → POINT → 행동 유도 → 약기법 각주 → 해시태그 5단계 구성이에요. 첫 2줄에 핵심을 담았어요.", has_image: false },
  ],
  hashtags,
  prompt_guide:
    "인스타그램 게시물을 일본어로 만들어 줘. 캐러셀은 최대 5장(커버 → 고민 → 제형 → 사용법 → 마무리), 슬라이드 문구는 2줄 이내. 캡션은 8~15줄로 첫 줄 훅 → POINT ①②③ → 「プロフィールのリンクから」 → 약기법 각주(※浸透：角質層まで, ※성분：保湿成分) → 해시태그 10~18개(브랜드·성분·고민). 효능은 보습·사용감만, 「絶対」「必ず」·의사 추천은 쓰지 마. 협찬 게시물이면 첫 줄에 【PR】.",
});

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
  // 인스타그램: 캐러셀 최대 5장(4:5 세로형) + 5단계 캡션(훅 → POINT → 행동 유도 → 약기법 각주 → 해시태그)
  igDraft(
    "ig-1",
    true,
    ["#うるおい習慣 はじめませんか", "#보습습관 시작해 볼까요"],
    "리뷰 소구점 1위 「오래가는 보습」과 2위 「산뜻한 흡수」를 첫 2줄에 담았어요. 「浸透」 뒤에 ※角質層まで 각주를 달아 약기법에 맞췄어요.",
    [
      ["＼毎日のうるおい習慣／\n{product}", "＼매일의 보습 습관／\n{product}"],
      ["乾燥が気になる季節、\nスキンケアに迷っていませんか？", "건조함이 신경 쓰이는 계절,\n스킨케어 고민하고 있지 않나요?"],
      ["さっぱりなのに、しっとり。\nべたつかないテクスチャー", "산뜻한데 촉촉하게.\n끈적이지 않는 제형"],
      ["洗顔後すぐ、手のひらでなじませるだけ", "세안 후 바로, 손으로 펴 바르기만"],
      ["プロフィールのリンクからチェック", "프로필 링크에서 확인하세요"],
    ],
    [
      "＼乾燥が気になる季節に／\nさっぱりなのに、しっとり続く{product}💧\n\nPOINT 💡\n① 角質層まで*うるおいを届ける\n② べたつかないみずみずしいテクスチャー\n③ 洗顔後すぐ、毎日使いやすい\n\n▼ 詳しくはプロフィールのリンクからチェック！\n\n*浸透：角質層まで\n*ヒアルロン酸Na、グリセリン：保湿成分",
      "＼건조함이 신경 쓰이는 계절에／\n산뜻한데 촉촉함이 이어지는 {product}💧\n\nPOINT 💡\n① 각질층까지* 수분을 전해요\n② 끈적이지 않는 촉촉한 제형\n③ 세안 후 바로, 매일 쓰기 쉬워요\n\n▼ 자세한 내용은 프로필 링크에서!\n\n*침투: 각질층까지\n*히알루론산Na, 글리세린: 보습 성분",
    ],
    ["#LeafAnd", "#リーフアンド", "#LeafAndDew", "#ヒアルロン酸", "#保湿成分", "#化粧水", "#さっぱり化粧水", "#乾燥肌", "#韓国スキンケア", "#韓国コスメ", "#スキンケア", "#保湿ケア"],
  ),
  igDraft(
    "ig-2",
    false,
    ["朝のスキンケア、これひとつ", "아침 스킨케어, 이거 하나"],
    "아침 사용 장면이 분명하지만 리뷰 소구점과의 연결이 1번보다 약해요.",
    [
      ["朝のスキンケアに\n{product}", "아침 스킨케어에\n{product}"],
      ["メイク前、肌がつっぱる…", "메이크업 전, 피부가 당긴다면…"],
      ["軽くなじんで、べたつかない", "가볍게 스며들고 끈적이지 않아요"],
      ["洗顔後 → {product} → メイク", "세안 → {product} → 메이크업"],
      ["毎朝のひと手間に", "매일 아침의 한 단계로"],
    ],
    [
      "＼朝のスキンケア、これひとつ／\nメイク前にもなじみやすい{product}🌿\n\nPOINT 💡\n① さっぱり軽いテクスチャー\n② べたつかないから重ねづけもOK\n③ 洗顔後すぐに使える\n\n▼ プロフィールのリンクからチェック！\n\n*ヒアルロン酸Na：保湿成分",
      "＼아침 스킨케어, 이거 하나／\n메이크업 전에도 잘 스며드는 {product}🌿\n\nPOINT 💡\n① 산뜻하고 가벼운 제형\n② 끈적이지 않아 덧발라도 OK\n③ 세안 후 바로 쓸 수 있어요\n\n▼ 프로필 링크에서 확인하세요!\n\n*히알루론산Na: 보습 성분",
    ],
    ["#LeafAnd", "#リーフアンド", "#朝スキンケア", "#化粧水", "#ヒアルロン酸", "#メイク前スキンケア", "#韓国スキンケア", "#韓国コスメ", "#スキンケア", "#保湿"],
  ),
  igDraft(
    "ig-3",
    false,
    ["乾燥する季節の、わたしの定番", "건조한 계절의 나의 단골템"],
    "계절감이 좋지만 「定番」이 순위처럼 읽히지 않게 근거 없는 순위 표현을 덧붙이지 말아야 해요.",
    [
      ["乾燥する季節の\nうるおいケアに", "건조한 계절의\n보습 케어에"],
      ["季節の変わり目、肌がゆらぎがち？", "환절기, 피부가 예민해지기 쉽나요?"],
      ["しっとり続くうるおい", "촉촉함이 이어지는 보습"],
      ["朝晩のスキンケアに", "아침저녁 스킨케어에"],
      ["{product}", "{product}"],
    ],
    [
      "＼季節の変わり目のうるおいケアに／\n乾燥する季節の定番に、{product}❄️\n\nPOINT 💡\n① しっとり続くうるおい\n② 肌をすこやかに保つ\n③ 朝晩のスキンケアに\n\n▼ プロフィールのリンクからチェック！\n\n*グリセリン：保湿成分",
      "＼환절기 보습 케어에／\n건조한 계절의 단골템으로 {product}❄️\n\nPOINT 💡\n① 촉촉함이 이어지는 보습\n② 피부를 건강하게 유지\n③ 아침저녁 스킨케어에\n\n▼ 프로필 링크에서 확인하세요!\n\n*글리세린: 보습 성분",
    ],
    ["#LeafAnd", "#リーフアンド", "#乾燥対策", "#保湿ケア", "#化粧水", "#季節の変わり目", "#韓国スキンケア", "#韓国コスメ", "#スキンケア", "#乾燥肌"],
  ),
  // X: 3~4줄 압축(100~130자), 해시태그 1~3개, 이미지 16:9, 링크는 첫 답글
  {
    id: "x-1",
    channel: "x",
    title_ja: "べたつかない保湿、試してみて",
    title_ko: "끈적이지 않는 보습, 써 보세요",
    recommended: true,
    reason: "첫 줄 「＼〜／」 훅에 리뷰 소구점 「산뜻한 흡수」를 담아 타임라인에서 바로 읽혀요. 130자 안이고 해시태그는 2개예요.",
    blocks: [
      {
        key: "post",
        heading: "게시글",
        options: [
          c("＼べたつかないのに、しっとり💧／\n\n洗顔後すぐになじむ\n{product}で毎日のうるおいケアを。\n\n👇商品ページはリプ欄から", "＼끈적이지 않는데 촉촉하게💧／\n\n세안 후 바로 스며드는\n{product}로 매일의 보습 케어를.\n\n👇상품 페이지는 답글에서"),
          c("【NEW】{product}\n乾燥が気になる季節の保湿ケアに。\nさっぱりなのにしっとり続く化粧水です✨", "【NEW】{product}\n건조함이 신경 쓰이는 계절의 보습 케어에.\n산뜻한데 촉촉함이 이어지는 스킨이에요✨"),
        ],
        reason: "3~4줄로 끊어 한 화면에 보여요. 외부 링크는 도달률이 떨어지지 않게 첫 답글로 돌렸어요.",
        has_image: false,
      },
      { key: "image", heading: "이미지 (16:9)", options: [c("テクスチャーのアップ", "제형 클로즈업")], reason: "글만으로 전하기 어려운 사용감을 보여 줘요. X는 이미지 첨부율이 높아요.", has_image: true },
    ],
    hashtags: ["#LeafAnd", "#保湿"],
    prompt_guide: "X 게시글을 일본어로 3~4줄, 100~130자로 써 줘. 첫 줄은 「＼〜／」 훅, 해시태그는 1~3개. 외부 링크는 본문에 넣지 말고 「リプ欄から」로 안내해. 효능 보증·최상급·의사 추천은 쓰지 마.",
  },
  {
    id: "x-2",
    channel: "x",
    title_ja: "朝の1本",
    title_ko: "아침의 한 병",
    recommended: false,
    reason: "짧고 인상적이지만 무엇이 좋은지가 덜 드러나요.",
    blocks: [
      {
        key: "post",
        heading: "게시글",
        options: [
          c("＼朝のスキンケアは1本から🌿／\n\nさっぱり、しっとり。\nメイク前にもなじむ{product}", "＼아침 스킨케어는 한 병부터🌿／\n\n산뜻하게, 촉촉하게.\n메이크업 전에도 스며드는 {product}"),
          c("メイク前にもなじむ軽さ。\n{product}", "메이크업 전에도 스며드는 가벼움.\n{product}"),
        ],
        reason: "사용 장면 하나로 짧게 썼어요.",
        has_image: false,
      },
      { key: "image", heading: "이미지 (16:9)", options: [c("朝の洗面台", "아침 세면대")], reason: "아침 장면이에요.", has_image: true },
    ],
    hashtags: ["#LeafAnd"],
    prompt_guide: "X 게시글을 일본어로 3~4줄로 짧게 써 줘. 사용 장면 하나에 집중하고 해시태그는 1~2개.",
  },
  {
    id: "x-3",
    channel: "x",
    title_ja: "季節の変わり目に",
    title_ko: "환절기에",
    recommended: false,
    reason: "계절 이슈와 맞지만 제품 특징이 적어요.",
    blocks: [
      {
        key: "post",
        heading: "게시글",
        options: [
          c("＼季節の変わり目のうるおいケア❄️／\n\n乾燥が気になったら\n{product}でしっとり。", "＼환절기 보습 케어❄️／\n\n건조함이 신경 쓰이면\n{product}로 촉촉하게."),
          c("乾燥が気になる季節に、{product}。", "건조함이 신경 쓰이는 계절에 {product}."),
        ],
        reason: "계절과 보습을 연결했어요. 「肌荒れが治る」처럼 치료로 읽히는 말은 뺐어요.",
        has_image: false,
      },
      { key: "image", heading: "이미지 (16:9)", options: [c("季節の風景と製品", "계절 풍경과 제품")], reason: "계절감을 보여 줘요.", has_image: true },
    ],
    hashtags: ["#LeafAnd", "#保湿ケア"],
    prompt_guide: "X 게시글을 일본어로 3~4줄로 써 줘. 계절감을 넣되 치료로 읽히는 말은 쓰지 마.",
  },
  // 인스타그램 캠페인 (프로모션·시즌)
  igDraft(
    "ig-c1",
    true,
    ["＼Qoo10メガ割で出会う／毎日のうるおい", "＼큐텐 메가와리에서 만나는／매일의 보습"],
    "프로모션 일정에 맞춘 게시물이에요. 할인율·한정 수량처럼 근거가 필요한 표현 없이 「메가와리 기간」만 알렸어요.",
    [
      ["＼Qoo10メガ割／\n{product}", "＼큐텐 메가와리／\n{product}"],
      ["メガ割期間に、毎日のうるおいケアを", "메가와리 기간에 매일의 보습 케어를"],
      ["さっぱりなのに、しっとり", "산뜻한데 촉촉하게"],
      ["洗顔後すぐ、なじませるだけ", "세안 후 바로 펴 바르기만"],
      ["プロフィールのリンクからチェック", "프로필 링크에서 확인"],
    ],
    [
      "＼Qoo10メガ割がはじまります／\nこの機会に{product}で毎日のうるおいケアを💧\n\nPOINT 💡\n① 角質層まで*うるおいを届ける\n② べたつかないテクスチャー\n③ 朝晩のスキンケアに\n\n▼ 詳しくはプロフィールのリンクから！\n\n*浸透：角質層まで\n※セール内容・期間はQoo10公式ページをご確認ください",
      "＼큐텐 메가와리가 시작돼요／\n이번 기회에 {product}로 매일의 보습 케어를💧\n\nPOINT 💡\n① 각질층까지* 수분을 전해요\n② 끈적이지 않는 제형\n③ 아침저녁 스킨케어에\n\n▼ 자세한 내용은 프로필 링크에서!\n\n*침투: 각질층까지\n※세일 내용·기간은 큐텐 공식 페이지를 확인해 주세요",
    ],
    ["#LeafAnd", "#リーフアンド", "#メガ割", "#Qoo10メガ割", "#メガ割おすすめ", "#化粧水", "#ヒアルロン酸", "#韓国スキンケア", "#韓国コスメ", "#保湿ケア"],
    "campaign",
  ),
  igDraft(
    "ig-c2",
    false,
    ["冬のうるおい準備、はじめよう", "겨울 보습 준비, 시작해요"],
    "시즌(겨울) 테마예요. 프로모션 일정이 없어도 쓸 수 있어요.",
    [
      ["＼冬のうるおい準備／", "＼겨울 보습 준비／"],
      ["空気が乾く季節、肌もカサつきがち？", "공기가 건조한 계절, 피부도 거칠어지기 쉽나요?"],
      ["しっとり続くうるおい", "촉촉함이 이어지는 보습"],
      ["朝晩のスキンケアに", "아침저녁 스킨케어에"],
      ["{product}", "{product}"],
    ],
    [
      "＼冬のうるおい準備、はじめよう❄️／\n空気が乾く季節も{product}でしっとり。\n\nPOINT 💡\n① 乾燥による肌あれを防ぐ\n② べたつかないのにしっとり続く\n③ 朝晩のスキンケアに\n\n▼ プロフィールのリンクからチェック！\n\n*グリセリン：保湿成分",
      "＼겨울 보습 준비, 시작해요❄️／\n공기가 건조한 계절에도 {product}로 촉촉하게.\n\nPOINT 💡\n① 건조로 인한 피부 거칠어짐을 막아요\n② 끈적이지 않는데 촉촉함이 이어져요\n③ 아침저녁 스킨케어에\n\n▼ 프로필 링크에서 확인하세요!\n\n*글리세린: 보습 성분",
    ],
    ["#LeafAnd", "#リーフアンド", "#冬スキンケア", "#乾燥対策", "#保湿ケア", "#化粧水", "#韓国スキンケア", "#韓国コスメ", "#乾燥肌", "#スキンケア"],
    "campaign",
  ),
  igDraft(
    "ig-c3",
    false,
    ["新生活のスキンケアに", "새 출발 스킨케어에"],
    "봄 새 학기·새 출발 시즌 테마예요. 계절 이벤트와 맞추기 좋지만 겨울엔 쓰기 어려워요.",
    [
      ["＼新生活のスキンケアに／", "＼새 출발 스킨케어에／"],
      ["忙しい朝も、手軽にうるおいケア", "바쁜 아침에도 간편하게 보습 케어"],
      ["さっぱり軽いテクスチャー", "산뜻하고 가벼운 제형"],
      ["洗顔後すぐに使える", "세안 후 바로 쓸 수 있어요"],
      ["{product}", "{product}"],
    ],
    [
      "＼新生活のスキンケアに🌸／\n忙しい朝も{product}で手軽にうるおいケア。\n\nPOINT 💡\n① さっぱり軽いテクスチャー\n② 洗顔後すぐに使える\n③ メイク前にもなじみやすい\n\n▼ プロフィールのリンクからチェック！\n\n*ヒアルロン酸Na：保湿成分",
      "＼새 출발 스킨케어에🌸／\n바쁜 아침에도 {product}로 간편하게 보습 케어.\n\nPOINT 💡\n① 산뜻하고 가벼운 제형\n② 세안 후 바로 쓸 수 있어요\n③ 메이크업 전에도 잘 스며들어요\n\n▼ 프로필 링크에서 확인하세요!\n\n*히알루론산Na: 보습 성분",
    ],
    ["#LeafAnd", "#リーフアンド", "#新生活", "#春スキンケア", "#朝スキンケア", "#化粧水", "#韓国スキンケア", "#韓国コスメ", "#スキンケア", "#保湿"],
    "campaign",
  ),
  // X 캠페인: 「フォロー＆リポスト」 프레젠트. 경품표시법에 따라 당첨 인원·응모 자격·마감을 적는다 (값은 가상)
  {
    id: "x-c1",
    channel: "x",
    post_type: "campaign",
    title_ja: "＼メガ割記念／フォロー＆リポストでプレゼント",
    title_ko: "＼메가와리 기념／팔로우＆리포스트로 선물",
    recommended: true,
    reason: "프로모션(메가와리)과 맞춘 응모형 게시물이에요. 경품표시법에 필요한 당첨 인원·응모 자격·마감을 모두 적었어요(값은 가상).",
    blocks: [
      {
        key: "post",
        heading: "게시글",
        options: [
          c("＼メガ割記念プレゼント🎁／\n{product}を抽選で10名様に✨\n\n▼応募方法\n①@leafand_jpをフォロー\n②この投稿をリポスト\n⏰○/○ 23:59まで", "＼메가와리 기념 선물🎁／\n{product}를 추첨으로 10분께✨\n\n▼응모 방법\n①@leafand_jp 팔로우\n②이 게시물 리포스트\n⏰○/○ 23:59까지"),
          c("【プレゼント企画】\n{product}を5名様に🎁\nフォロー＆リポストで応募完了！\n⏰○/○まで", "【선물 이벤트】\n{product}를 5분께🎁\n팔로우＆리포스트로 응모 완료!\n⏰○/○까지"),
        ],
        reason: "응모 방법을 번호로 나눠 한눈에 보여요. 세부 조건은 첫 답글에 적어요.",
        has_image: false,
      },
      {
        key: "terms",
        heading: "응모 조건 (첫 답글)",
        options: [c("※日本国内在住の方限定\n※当選者様にはDMでご連絡します\n※当選発表は○/○予定", "※일본 국내 거주자 한정\n※당첨자에게는 DM으로 연락드려요\n※당첨 발표는 ○/○ 예정")],
        reason: "경품표시법 대응으로 응모 자격·통보 방법·발표 일정을 밝혀요.",
        has_image: false,
      },
      { key: "image", heading: "이미지 (16:9)", options: [c("プレゼント製品＋「10名様」の告知画像", "선물 제품 + 「10명」 안내 이미지")], reason: "당첨 인원이 이미지에서 바로 읽히게 해요.", has_image: true },
    ],
    hashtags: ["#LeafAnd", "#メガ割"],
    prompt_guide: "X 응모형 캠페인 게시물을 일본어로 3~4줄로 써 줘. 첫 줄 「＼〇〇記念プレゼント／」, 응모 방법 ①팔로우 ②리포스트, 마감일. 해시태그 1~3개. 첫 답글에 응모 자격(日本国内在住)·당첨 통보·발표일을 적어(경품표시법). 효능 보증 표현은 쓰지 마.",
  },
  {
    id: "x-c2",
    channel: "x",
    post_type: "campaign",
    title_ja: "冬のうるおいケアキャンペーン",
    title_ko: "겨울 보습 케어 캠페인",
    recommended: false,
    reason: "시즌(겨울) 테마 응모형이에요. 프로모션 일정과 상관없이 쓸 수 있어요.",
    blocks: [
      {
        key: "post",
        heading: "게시글",
        options: [
          c("＼冬のうるおいケアキャンペーン❄️／\n{product}を抽選で10名様に🎁\n\n①フォロー ②リポストで応募\n⏰○/○まで", "＼겨울 보습 케어 캠페인❄️／\n{product}를 추첨으로 10분께🎁\n\n①팔로우 ②리포스트로 응모\n⏰○/○까지"),
          c("乾燥する季節に、{product}をプレゼント🎁\nフォロー＆リポストで応募！", "건조한 계절에 {product}를 선물🎁\n팔로우＆리포스트로 응모!"),
        ],
        reason: "계절 훅으로 시작하고 응모 방법은 한 줄로 압축했어요.",
        has_image: false,
      },
      { key: "terms", heading: "응모 조건 (첫 답글)", options: [c("※日本国内在住の方限定\n※当選者様にはDMでご連絡します", "※일본 국내 거주자 한정\n※당첨자에게는 DM으로 연락드려요")], reason: "응모 자격과 통보 방법을 밝혀요.", has_image: false },
      { key: "image", heading: "이미지 (16:9)", options: [c("冬の背景＋プレゼント製品", "겨울 배경 + 선물 제품")], reason: "계절감과 선물이 함께 보여요.", has_image: true },
    ],
    hashtags: ["#LeafAnd", "#プレゼント企画"],
    prompt_guide: "X 시즌 캠페인 게시물을 일본어로 3~4줄로 써 줘. 계절 훅 + 응모 방법 + 마감. 첫 답글에 응모 자격·당첨 통보를 적어.",
  },
  {
    id: "x-c3",
    channel: "x",
    post_type: "campaign",
    title_ja: "【特報】メガ割スタート",
    title_ko: "【특보】메가와리 시작",
    recommended: false,
    reason: "응모 없이 프로모션 시작만 알리는 게시물이에요. 확산력은 응모형보다 약해요.",
    blocks: [
      {
        key: "post",
        heading: "게시글",
        options: [
          c("【特報】Qoo10メガ割がスタート🎉\n{product}もこの機会にチェック✨\n\n👇商品ページはリプ欄から", "【특보】큐텐 메가와리 시작🎉\n{product}도 이번 기회에 확인하세요✨\n\n👇상품 페이지는 답글에서"),
          c("＼メガ割はじまりました／\n{product}をチェック！", "＼메가와리 시작했어요／\n{product}를 확인하세요!"),
        ],
        reason: "「최저가」「今だけ」 같은 근거 없는 한정 표현 없이 행사 시작만 알려요.",
        has_image: false,
      },
      { key: "image", heading: "이미지 (16:9)", options: [c("メガ割告知バナー", "메가와리 안내 배너")], reason: "행사 배너를 그대로 써요.", has_image: true },
    ],
    hashtags: ["#LeafAnd", "#メガ割"],
    prompt_guide: "X 프로모션 안내 게시물을 일본어로 3~4줄로 써 줘. 【特報】로 시작하고 링크는 답글로. 최저가·한정 같은 근거 없는 표현은 쓰지 마.",
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
