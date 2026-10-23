// 콘텐츠 제작 가이드 샘플 (가짜 데이터). 실제 AI 출력이 아니다.
// 사용처마다 3개. 제품 이름은 화면에서 {product} 자리에 넣고, 상세페이지는 플랫폼과 상관없이 같은 샘플을 쓴다.
// 문구는 효능 범위 안의 표현(보습·사용감)만 쓴다. 게시 전에는 새 검토로 다시 확인한다.
import { z } from "zod";
import { AdUsage } from "@/lib/schemas/ad-check";

export const GuideSection = z.object({
  heading: z.string(),
  text_ja: z.string(),
  text_ko: z.string(),
});
export type GuideSection = z.infer<typeof GuideSection>;

export const GuideDraft = z.object({
  id: z.string(),
  usage: AdUsage,
  title_ja: z.string(),
  title_ko: z.string(),
  preview_ja: z.string(),
  preview_ko: z.string(),
  /** 아래 본문. 상세페이지는 소구점 어필 → 성분 → 리뷰 순서 (초안) */
  sections: z.array(GuideSection),
  /** AI에 넣을 프롬프트 가이드 (한국어) */
  prompt_guide: z.string(),
});
export type GuideDraft = z.infer<typeof GuideDraft>;

const RAW: unknown[] = [
  // 상세페이지
  {
    id: "dp-1",
    usage: "detail_page",
    title_ja: "毎日のうるおいを、角質層まで",
    title_ko: "매일의 수분을, 각질층까지",
    preview_ja: "{product}\n毎日のうるおいを、角質層まで。\nヒアルロン酸Na配合（保湿成分）",
    preview_ko: "{product}\n매일의 수분을, 각질층까지.\n히알루론산Na 배합(보습 성분)",
    sections: [
      { heading: "소구점 어필", text_ja: "乾燥が気になる季節も、角質層までうるおいを届けます。", text_ko: "건조함이 신경 쓰이는 계절에도 각질층까지 수분을 전합니다." },
      { heading: "성분", text_ja: "保湿成分：ヒアルロン酸Na・グリセリン", text_ko: "보습 성분: 히알루론산Na·글리세린" },
      { heading: "리뷰", text_ja: "「しっとりするのにべたつかない」という声が多い使い心地です。", text_ko: "「촉촉한데 끈적이지 않는다」는 평이 많은 사용감입니다." },
    ],
    prompt_guide:
      "상세페이지용 문구를 일본어로 써 줘. 순서는 소구점 → 성분 → 리뷰. 효능은 화장품 효능 범위 56항목 안(보습·피부결 정돈)만 쓰고, 성분을 내세울 때는 배합 목적(保湿成分 등)을 함께 적어. 침투 표현은 「角質層まで」로만. 리뷰는 사용감 표현만 고르고 효과를 보증하는 말은 빼.",
  },
  {
    id: "dp-2",
    usage: "detail_page",
    title_ja: "肌のキメを整える、しっとりローション",
    title_ko: "피부결을 정돈하는 촉촉한 로션",
    preview_ja: "{product}\n肌のキメを整える、しっとりローション。",
    preview_ko: "{product}\n피부결을 정돈하는 촉촉한 로션.",
    sections: [
      { heading: "소구점 어필", text_ja: "洗顔後すぐになじませて、肌のキメを整えます。", text_ko: "세안 후 바로 발라 피부결을 정돈합니다." },
      { heading: "성분", text_ja: "保湿成分：パンテノール・ベタイン", text_ko: "보습 성분: 판테놀·베타인" },
      { heading: "리뷰", text_ja: "「朝のメイク前にも使いやすい」との声。", text_ko: "「아침 메이크업 전에도 쓰기 좋다」는 평." },
    ],
    prompt_guide:
      "상세페이지용 문구를 일본어로 써 줘. 「キメを整える」처럼 효능 범위 안의 표현만 쓰고, 개선·회복·재생 같은 말은 쓰지 마. 성분은 배합 목적과 함께 적고, 리뷰는 사용 장면 위주로 골라.",
  },
  {
    id: "dp-3",
    usage: "detail_page",
    title_ja: "乾燥が気になる日の、うるおい習慣",
    title_ko: "건조함이 신경 쓰이는 날의 보습 습관",
    preview_ja: "{product}\n乾燥が気になる日の、うるおい習慣。",
    preview_ko: "{product}\n건조함이 신경 쓰이는 날의 보습 습관.",
    sections: [
      { heading: "소구점 어필", text_ja: "朝晩のスキンケアに取り入れやすい、なじみのよいテクスチャー。", text_ko: "아침저녁 스킨케어에 넣기 쉬운, 잘 스며드는 제형." },
      { heading: "성분", text_ja: "保湿成分：セラミドNP・スクワラン", text_ko: "보습 성분: 세라마이드NP·스쿠알란" },
      { heading: "리뷰", text_ja: "「香りが控えめで毎日使える」という声。", text_ko: "「향이 은은해서 매일 쓸 수 있다」는 평." },
    ],
    prompt_guide:
      "상세페이지용 문구를 일본어로 써 줘. 사용 장면(아침저녁, 건조한 날)을 소구점으로 쓰고, 기간·수치로 효과를 약속하지 마. No.1·최고 같은 최상급 표현은 근거 자료 없이 쓰지 마.",
  },
  // SNS
  {
    id: "sns-1",
    usage: "sns",
    title_ja: "#うるおい習慣 はじめませんか",
    title_ko: "#보습습관 시작해 볼까요",
    preview_ja: "{product}で、毎日の #うるおい習慣 を。",
    preview_ko: "{product}로 매일의 #보습습관 을.",
    sections: [
      { heading: "SNS 문구", text_ja: "洗顔後のひと手間で、しっとり。#スキンケア #保湿", text_ko: "세안 후 한 단계로 촉촉하게. #스킨케어 #보습" },
    ],
    prompt_guide:
      "SNS 게시글을 일본어로 짧게 써 줘. 해시태그는 3개 이내, 효능은 보습·사용감만. 「絶対」「必ず」처럼 보증하는 말과 의사·전문가 추천 표현은 쓰지 마.",
  },
  {
    id: "sns-2",
    usage: "sns",
    title_ja: "朝のスキンケア、これひとつ",
    title_ko: "아침 스킨케어, 이거 하나",
    preview_ja: "朝のスキンケアに {product}。さっぱりなのに、しっとり。",
    preview_ko: "아침 스킨케어에 {product}. 산뜻한데 촉촉하게.",
    sections: [
      { heading: "SNS 문구", text_ja: "メイク前にもなじみやすい、軽いテクスチャー。", text_ko: "메이크업 전에도 잘 스며드는 가벼운 제형." },
    ],
    prompt_guide: "SNS 게시글을 일본어로 써 줘. 사용 장면 하나(아침)에 집중하고, 제형·사용감을 구체적으로 묘사해.",
  },
  {
    id: "sns-3",
    usage: "sns",
    title_ja: "乾燥する季節の、わたしの定番",
    title_ko: "건조한 계절의 나의 단골템",
    preview_ja: "乾燥する季節の定番に、{product}。",
    preview_ko: "건조한 계절의 단골템으로 {product}.",
    sections: [
      { heading: "SNS 문구", text_ja: "季節の変わり目も、うるおいケアを続けたい方に。", text_ko: "환절기에도 보습 케어를 이어 가고 싶은 분께." },
    ],
    prompt_guide: "SNS 게시글을 일본어로 써 줘. 계절감을 넣되 「肌荒れが治る」처럼 치료로 읽히는 말은 쓰지 마.",
  },
  // 광고 배너
  {
    id: "bn-1",
    usage: "banner",
    title_ja: "角質層まで、うるおう。",
    title_ko: "각질층까지 촉촉하게.",
    preview_ja: "{product}\n角質層まで、うるおう。",
    preview_ko: "{product}\n각질층까지 촉촉하게.",
    sections: [{ heading: "배너 문구", text_ja: "角質層まで、うるおう。", text_ko: "각질층까지 촉촉하게." }],
    prompt_guide: "배너용 한 줄 문구를 일본어로 15자 안팎으로 써 줘. 순위·최상급 표현과 기간 약속은 쓰지 마.",
  },
  {
    id: "bn-2",
    usage: "banner",
    title_ja: "毎日の、しっとり。",
    title_ko: "매일의 촉촉함.",
    preview_ja: "{product}\n毎日の、しっとり。",
    preview_ko: "{product}\n매일의 촉촉함.",
    sections: [{ heading: "배너 문구", text_ja: "毎日の、しっとり。", text_ko: "매일의 촉촉함." }],
    prompt_guide: "배너용 한 줄 문구를 일본어로 짧게 써 줘. 사용감 한 단어를 중심에 둬.",
  },
  {
    id: "bn-3",
    usage: "banner",
    title_ja: "キメを整える、うるおいケア",
    title_ko: "피부결을 정돈하는 보습 케어",
    preview_ja: "{product}\nキメを整える、うるおいケア。",
    preview_ko: "{product}\n피부결을 정돈하는 보습 케어.",
    sections: [{ heading: "배너 문구", text_ja: "キメを整える、うるおいケア。", text_ko: "피부결을 정돈하는 보습 케어." }],
    prompt_guide: "배너용 문구를 일본어로 써 줘. 효능 범위 안의 표현(キメを整える 등) 하나만 써.",
  },
  // 설문 결과 페이지
  {
    id: "sv-1",
    usage: "survey_result",
    title_ja: "乾燥が気になるあなたに",
    title_ko: "건조함이 신경 쓰이는 당신에게",
    preview_ja: "乾燥が気になるあなたには、{product} がおすすめです。",
    preview_ko: "건조함이 신경 쓰이는 당신에게는 {product}를 추천합니다.",
    sections: [{ heading: "설문 결과 문구", text_ja: "うるおいを与え、肌をすこやかに保ちます。", text_ko: "수분을 주고 피부를 건강하게 유지합니다." }],
    prompt_guide: "설문 결과 추천 문구를 일본어로 써 줘. 피부 타입을 진단하는 것처럼 쓰지 말고, 사용감 중심으로 추천해.",
  },
  {
    id: "sv-2",
    usage: "survey_result",
    title_ja: "しっとり派のあなたに",
    title_ko: "촉촉함을 좋아하는 당신에게",
    preview_ja: "しっとりした使い心地が好きなあなたに、{product}。",
    preview_ko: "촉촉한 사용감을 좋아하는 당신에게 {product}.",
    sections: [{ heading: "설문 결과 문구", text_ja: "洗顔後すぐに使える、なじみのよいテクスチャー。", text_ko: "세안 후 바로 쓸 수 있는, 잘 스며드는 제형." }],
    prompt_guide: "설문 결과 추천 문구를 일본어로 써 줘. 응답한 취향(사용감)을 이유로 들고 효과는 약속하지 마.",
  },
  {
    id: "sv-3",
    usage: "survey_result",
    title_ja: "季節の変わり目のケアに",
    title_ko: "환절기 케어에",
    preview_ja: "季節の変わり目のうるおいケアに、{product}。",
    preview_ko: "환절기 보습 케어에 {product}.",
    sections: [{ heading: "설문 결과 문구", text_ja: "乾燥による肌あれを防ぎます。", text_ko: "건조로 인한 피부 거칠어짐을 막아 줍니다." }],
    prompt_guide: "설문 결과 추천 문구를 일본어로 써 줘. 「乾燥による肌あれを防ぐ」처럼 효능 범위 문구를 그대로 쓰고 바꿔 말하지 마.",
  },
  // 알림받기 버튼
  {
    id: "nt-1",
    usage: "notify_button",
    title_ja: "発売のお知らせを受け取る",
    title_ko: "출시 알림 받기",
    preview_ja: "{product} の発売のお知らせを受け取る",
    preview_ko: "{product} 출시 알림 받기",
    sections: [{ heading: "버튼 문구", text_ja: "発売のお知らせを受け取る", text_ko: "출시 알림 받기" }],
    prompt_guide: "알림받기 버튼 문구를 일본어로 짧게 써 줘. 버튼에는 효능을 넣지 마.",
  },
  {
    id: "nt-2",
    usage: "notify_button",
    title_ja: "いち早く情報を受け取る",
    title_ko: "가장 먼저 소식 받기",
    preview_ja: "{product} の情報をいち早く受け取る",
    preview_ko: "{product} 소식을 가장 먼저 받기",
    sections: [{ heading: "버튼 문구", text_ja: "いち早く情報を受け取る", text_ko: "가장 먼저 소식 받기" }],
    prompt_guide: "알림받기 버튼 문구를 일본어로 써 줘. 「限定」「今だけ」처럼 근거 없는 한정 표현은 쓰지 마.",
  },
  {
    id: "nt-3",
    usage: "notify_button",
    title_ja: "新商品の情報を見る",
    title_ko: "신제품 소식 보기",
    preview_ja: "{product} の新商品情報を見る",
    preview_ko: "{product} 신제품 소식 보기",
    sections: [{ heading: "버튼 문구", text_ja: "新商品の情報を見る", text_ko: "신제품 소식 보기" }],
    prompt_guide: "알림받기 버튼 문구를 일본어로 써 줘. 행동(受け取る・見る)이 분명하게 드러나게 해.",
  },
];

/** 불러올 때 Zod로 검증한다 */
export const GUIDE_DRAFTS: GuideDraft[] = z.array(GuideDraft).parse(RAW);

/** {product} 자리에 제품 이름을 넣는다 */
export function fillProduct(text: string, productName: string): string {
  return text.replaceAll("{product}", productName);
}
