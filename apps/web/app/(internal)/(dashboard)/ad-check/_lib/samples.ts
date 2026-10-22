// 테스트 광고 문구 A01~A20과 샘플 판정 (모두 가상 데이터). 실제 AI 출력이 아니다.
// 문구 출처: 팀이 만든 leaf_and_japan_marketing_test_data.csv
// 근거(basis)는 knowledge/yakkiho/ 발췌본의 항목 번호. 법적 판정이 아니므로 basis_status는 모두 needs_check.
import { z } from "zod";
import { AdAction, AdFinding, AdUsage, SuggestionRecheck } from "@/lib/schemas/ad-check";

export const SampleCopy = z.object({
  id: z.string(),
  product_id: z.string(),
  usage: AdUsage,
  ko: z.string(),
  ja_literal: z.string(),
  /** 정답이 아니라 작성 의도(가설) */
  intent_hypothesis: z.enum(["safe", "borderline", "risky"]),
});
export type SampleCopy = z.infer<typeof SampleCopy>;

/** 문구 1줄의 샘플 판정. line_index는 검토할 때 붙인다 */
export const SampleJudgment = z.object({
  sample_id: z.string(),
  action: AdAction,
  findings: z.array(AdFinding.omit({ line_index: true })),
  ingredient_check: z.string(),
  translated_text: z.string(),
  back_translation_ko: z.string(),
  localized_note: z.string(),
});
export type SampleJudgment = z.infer<typeof SampleJudgment>;

type Recheck = z.infer<typeof SuggestionRecheck>;
type Finding = z.infer<typeof SampleJudgment>["findings"][number];

const RISK_BY_ACTION = { must_fix: "high", should_fix: "medium", expert: "medium", ok: "low" } as const;

function pass(text: string, recheck_reason: string): Recheck {
  return { text, recheck: "pass", recheck_reason };
}

function rework(text: string, recheck_reason: string): Recheck {
  return { text, recheck: "needs_rework", recheck_reason };
}

function finding(action: z.infer<typeof AdAction>, text: string, reason: string, basis: string, rechecks: Recheck[] = []): Finding {
  return {
    text,
    risk: RISK_BY_ACTION[action],
    reason,
    basis,
    suggestions: rechecks.map((r) => r.text),
    action,
    basis_status: "needs_check",
    suggestion_rechecks: rechecks,
  };
}

export const SAMPLE_COPIES: unknown[] = [
  { id: "A01", product_id: "leaf-dry-skin", usage: "detail_page", ko: "히알루론산과 글리세린으로 피부를 촉촉하게 가꿔주는 데일리 스킨", ja_literal: "ヒアルロン酸とグリセリンで肌をしっとり整えるデイリーローション", intent_hypothesis: "safe" },
  { id: "A02", product_id: "leaf-dry-essence", usage: "sns", ko: "세라마이드와 콜레스테롤을 담아 건조한 피부를 위한 보습 케어", ja_literal: "セラミドとコレステロールを配合し、乾燥した肌のための保湿ケア", intent_hypothesis: "safe" },
  { id: "A03", product_id: "leaf-dry-skin", usage: "banner", ko: "매일 아침저녁, 촉촉한 피부를 위한 첫 번째 습관", ja_literal: "毎朝晩、しっとりした肌のための最初の習慣", intent_hypothesis: "safe" },
  { id: "A04", product_id: "leaf-dry-essence", usage: "detail_page", ko: "히알루론산과 피부 보습 성분으로 매끄러운 피부결을 가꿔보세요", ja_literal: "ヒアルロン酸と肌の保湿成分で、なめらかな肌のキメを整えましょう", intent_hypothesis: "safe" },
  { id: "A05", product_id: "leaf-oily-skin", usage: "sns", ko: "판테놀과 녹차추출물을 담은 산뜻한 스킨케어, 곧 만나요", ja_literal: "パンテノールとチャ葉エキスを配合したさっぱりしたスキンケア、もうすぐ登場", intent_hypothesis: "safe" },
  { id: "A06", product_id: "leaf-combo-skin", usage: "notify_button", ko: "히알루론산과 베타인을 담은 신제품 소식 가장 먼저 받기", ja_literal: "ヒアルロン酸とベタインを配合した新商品の情報をいち早く受け取る", intent_hypothesis: "safe" },
  { id: "A07", product_id: "leaf-dry-essence", usage: "detail_page", ko: "한 번의 사용으로 건조함을 완전히 해결하는 집중 에센스", ja_literal: "1回の使用で乾燥を完全に解決する集中エッセンス", intent_hypothesis: "borderline" },
  { id: "A08", product_id: "leaf-dry-skin", usage: "sns", ko: "히알루론산이 피부 속 깊이 스며들어 수분을 꽉 채워줍니다", ja_literal: "ヒアルロン酸が肌の奥深くまで浸透し、水分をたっぷり満たします", intent_hypothesis: "borderline" },
  { id: "A09", product_id: "leaf-dry-essence", usage: "banner", ko: "피부 장벽을 강화하는 세라마이드 보습 솔루션", ja_literal: "肌のバリアを強化するセラミド保湿ソリューション", intent_hypothesis: "borderline" },
  { id: "A10", product_id: "leaf-dry-skin", usage: "survey_result", ko: "응답자의 95%가 사용 후 촉촉함에 만족했다고 답했습니다", ja_literal: "回答者の95％が使用後のうるおいに満足したと答えました", intent_hypothesis: "borderline" },
  { id: "A11", product_id: "leaf-combo-skin", usage: "detail_page", ko: "번들거림은 줄이고 수분은 채워주는 복합성 피부 맞춤 케어", ja_literal: "テカリを減らし、水分を補う混合肌向けケア", intent_hypothesis: "borderline" },
  { id: "A12", product_id: "leaf-dry-essence", usage: "sns", ko: "세라마이드와 지방산이 무너진 피부 장벽을 되살리는 데 도움을 줍니다", ja_literal: "セラミドと脂肪酸が、崩れた肌のバリアをよみがえらせるのを助けます", intent_hypothesis: "borderline" },
  { id: "A13", product_id: "leaf-dry-essence", usage: "detail_page", ko: "단 3일 만에 손상된 피부 장벽을 완벽하게 복구합니다", ja_literal: "たった3日で傷ついた肌のバリアを完璧に修復します", intent_hypothesis: "risky" },
  { id: "A14", product_id: "leaf-dry-skin", usage: "banner", ko: "일본 보습 스킨 판매 1위! 건조함을 끝내는 단 하나의 선택", ja_literal: "日本の保湿化粧水販売1位！乾燥を終わらせる唯一の選択", intent_hypothesis: "risky" },
  { id: "A15", product_id: "leaf-dry-essence", usage: "sns", ko: "피부과 전문의가 강력 추천하는 피부 장벽 재생 에센스", ja_literal: "皮膚科専門医が強く推薦する肌のバリア再生エッセンス", intent_hypothesis: "risky" },
  { id: "A16", product_id: "leaf-dry-skin", usage: "detail_page", ko: "무자극 테스트 완료! 누구나 부작용 걱정 없이 사용할 수 있습니다", ja_literal: "無刺激テスト完了！誰でも副作用を心配せずに使用できます", intent_hypothesis: "risky" },
  { id: "A17", product_id: "leaf-dry-essence", usage: "banner", ko: "단 한 번의 사용으로 피부 속 세포부터 되살리는 기적의 에센스", ja_literal: "たった1回の使用で肌の細胞からよみがえらせる奇跡のエッセンス", intent_hypothesis: "risky" },
  { id: "A18", product_id: "leaf-dry-skin", usage: "survey_result", ko: "실제 사용자의 100%가 피부 트러블이 사라졌다고 증언했습니다", ja_literal: "実際の使用者の100％が肌トラブルが消えたと証言しました", intent_hypothesis: "risky" },
  { id: "A19", product_id: "leaf-oily-skin", usage: "sns", ko: "개발 중인 신제품으로 과도한 피지를 완벽하게 억제하고 여드름까지 치료하세요", ja_literal: "開発中の新商品で過剰な皮脂を完全に抑え、ニキビまで治療しましょう", intent_hypothesis: "risky" },
  { id: "A20", product_id: "leaf-combo-skin", usage: "notify_button", ko: "곧 출시! 모공을 완전히 닫고 유수분 밸런스를 영구적으로 정상화하는 신제품", ja_literal: "まもなく発売！毛穴を完全に閉じ、油水分バランスを永久に正常化する新商品", intent_hypothesis: "risky" },
];

const E24 = "E24 성분 특기 표시 (03)";

export const SAMPLE_JUDGMENTS: unknown[] = [
  {
    sample_id: "A01",
    action: "should_fix",
    findings: [
      finding("should_fix", "히알루론산과 글리세린으로", "특정 성분을 내세우면 배합 목적을 함께 적어야 함 (유효 성분으로 오인 방지)", E24, [
        pass("보습 성분(히알루론산·글리세린) 배합으로 피부를 촉촉하게 가꿔주는 데일리 스킨", "배합 목적 「보습」 명기, 효능 범위 (24) 안"),
      ]),
    ],
    ingredient_check: "히알루론산나트륨·글리세린 모두 전성분에 있음",
    translated_text: "ヒアルロン酸とグリセリンで肌をしっとり整えるデイリーローション",
    back_translation_ko: "히알루론산과 글리세린으로 피부를 촉촉하게 정돈하는 데일리 로션",
    localized_note: "일본에서는 「保湿成分：ヒアルロン酸Na」처럼 배합 목적을 성분명 옆에 붙이는 형식이 일반적",
  },
  {
    sample_id: "A02",
    action: "should_fix",
    findings: [
      finding("should_fix", "세라마이드와 콜레스테롤을 담아", "특정 성분을 내세우면 배합 목적을 함께 적어야 함", E24, [
        pass("보습 성분(세라마이드·콜레스테롤)을 담은 건조한 피부를 위한 보습 케어", "배합 목적 「보습」 명기"),
      ]),
    ],
    ingredient_check: "세라마이드 NP·콜레스테롤 모두 전성분에 있음",
    translated_text: "セラミドとコレステロールを配合し、乾燥した肌のための保湿ケア",
    back_translation_ko: "세라마이드와 콜레스테롤을 배합한, 건조한 피부를 위한 보습 케어",
    localized_note: "「乾燥した肌のための」보다 「乾燥肌用」가 자연스러움 (E4: ○○用은 허용)",
  },
  {
    sample_id: "A03",
    action: "ok",
    findings: [],
    ingredient_check: "성분·효능 언급 없음",
    translated_text: "毎朝晩、しっとりした肌のための最初の習慣",
    back_translation_ko: "매일 아침저녁, 촉촉한 피부를 위한 첫 습관",
    localized_note: "「最初の習慣」은 직역 느낌. 「毎日のうるおい習慣」 정도가 자연스러움",
  },
  {
    sample_id: "A04",
    action: "should_fix",
    findings: [
      finding("should_fix", "히알루론산과 피부 보습 성분으로", "성분명을 내세울 때 배합 목적 명기 필요. 「피부 보습 성분」은 어떤 성분인지도 불명확", E24, [
        pass("보습 성분(히알루론산) 배합으로 피부결을 매끄럽게 가꿔보세요", "배합 목적 명기, 효능 범위 (20)(32) 안"),
      ]),
    ],
    ingredient_check: "히알루론산나트륨 있음. 「피부 보습 성분」이 가리키는 성분 불명",
    translated_text: "ヒアルロン酸と肌の保湿成分で、なめらかな肌のキメを整えましょう",
    back_translation_ko: "히알루론산과 피부 보습 성분으로 매끄러운 피부결을 정돈하세요",
    localized_note: "「キメを整える」는 효능 범위 (20)의 표현이라 자연스러움",
  },
  {
    sample_id: "A05",
    action: "expert",
    findings: [
      finding("expert", "곧 만나요", "출시 전 제품 예고. 제품 구분·일본 판매 절차가 미정이라 광고 가능 시점 확인 필요", "薬機法 第66条 (04)", [
        pass("산뜻한 사용감의 스킨케어를 준비하고 있어요", "성분·효능 언급 없이 준비 사실만 전달"),
      ]),
    ],
    ingredient_check: "판테놀·녹차추출물은 개발 중 처방 기준. 처방 확정 전",
    translated_text: "パンテノールとチャ葉エキスを配合したさっぱりしたスキンケア、もうすぐ登場",
    back_translation_ko: "판테놀과 녹차잎 추출물을 배합한 산뜻한 스킨케어, 곧 등장",
    localized_note: "성분을 남기려면 배합 목적도 함께 (E24). 출시 시기가 정해지면 함께 표기",
  },
  {
    sample_id: "A06",
    action: "expert",
    findings: [
      finding("expert", "신제품 소식 가장 먼저 받기", "알림 신청으로 이메일을 받으면 광고 메일 동의·수신 거부 방법 표시가 필요. 개인정보(APPI)는 별도 확인", "特定商取引法 第12条の3 (04) / F12.1 (02)", [
        pass("신제품 출시 소식 받기", "성분 언급 없이 알림 기능만 전달. 동의 문구는 별도"),
      ]),
    ],
    ingredient_check: "히알루론산나트륨·베타인은 개발 중 처방 기준",
    translated_text: "ヒアルロン酸とベタインを配合した新商品の情報をいち早く受け取る",
    back_translation_ko: "히알루론산과 베타인을 배합한 신상품 정보를 가장 빨리 받기",
    localized_note: "버튼 문구로는 「新商品のお知らせを受け取る」처럼 짧게 하는 편이 일반적",
  },
  {
    sample_id: "A07",
    action: "must_fix",
    findings: [
      finding("must_fix", "한 번의 사용으로", "1회 사용만으로 효과가 난다는 속효성 표현", "F9.0 (02)"),
      finding("must_fix", "완전히 해결하는", "효과를 확실하다고 보증하는 표현", "F7.0 (02)", [
        pass("건조한 피부에 집중 보습을 더하는 에센스", "효과 단정 없이 보습 사용 목적만"),
        rework("한 번만 써도 촉촉함이 느껴지는 에센스", "사용감 표현이지만 '한 번만'이 속효로 읽힐 수 있음"),
      ]),
    ],
    ingredient_check: "보습 성분은 있으나 '완전 해결'을 뒷받침하는 자료 없음",
    translated_text: "1回の使用で乾燥を完全に解決する集中エッセンス",
    back_translation_ko: "1회 사용으로 건조를 완전히 해결하는 집중 에센스",
    localized_note: "일본어에서도 「完全に解決」은 강한 단정으로 읽힘",
  },
  {
    sample_id: "A08",
    action: "should_fix",
    findings: [
      finding("should_fix", "피부 속 깊이 스며들어", "침투 표현은 「각질층」 범위로 명기해야 하고, 「피부 깊이」는 각질층을 넘는 인상", "E3 (03)", [
        pass("히알루론산이 각질층까지 스며들어 촉촉함을 채워줍니다", "E3 「表現できる例」 형식 (角質層へ浸透)"),
      ]),
    ],
    ingredient_check: "히알루론산나트륨 있음. 성분을 내세우므로 배합 목적도 필요 (E24)",
    translated_text: "ヒアルロン酸が肌の奥深くまで浸透し、水分をたっぷり満たします",
    back_translation_ko: "히알루론산이 피부 안쪽 깊은 곳까지 침투해 수분을 듬뿍 채웁니다",
    localized_note: "「肌の奥深く」는 E3의 「表現できない例」에 해당. 「角質層まで」로 한정",
  },
  {
    sample_id: "A09",
    action: "should_fix",
    findings: [
      finding("should_fix", "피부 장벽을 강화하는", "효능 범위 56항목에 「장벽 강화」가 없음. 범위 안의 표현으로 바꿔야 함", "F4.1 〔表3〕 (01)", [
        pass("건조로부터 피부를 보호하는 세라마이드 보습", "효능 범위 (27) 皮膚を保護する, (28) 皮膚の乾燥を防ぐ"),
      ]),
    ],
    ingredient_check: "세라마이드 NP 있음. 장벽 관련 시험 결과 없음",
    translated_text: "肌のバリアを強化するセラミド保湿ソリューション",
    back_translation_ko: "피부 장벽을 강화하는 세라마이드 보습 솔루션",
    localized_note: "「ソリューション」은 일본 화장품 광고에서 다소 딱딱한 인상",
  },
  {
    sample_id: "A10",
    action: "must_fix",
    findings: [
      finding("must_fix", "응답자의 95%가", "만족도 수치는 효능을 확실하다고 오인시켜 원칙적으로 불가. 조사 원자료도 없음", "E22 (03) / 景品表示法 第7条第2項 (04)", [
        pass("촉촉한 사용감을 원하는 분께 추천하는 스킨", "수치 없이 사용감 중심"),
        rework("(조사 후) 사용감 만족도 ○% (조사 기간·대상·인원 명기)", "E22: 사용감에 한정하고 조사 개요를 밝힐 때만 가능. 조사 전에는 불가"),
      ]),
    ],
    ingredient_check: "성분 언급 없음",
    translated_text: "回答者の95％が使用後のうるおいに満足したと答えました",
    back_translation_ko: "응답자의 95%가 사용 후 촉촉함에 만족했다고 답했습니다",
    localized_note: "「うるおいに満足」은 효능 만족으로 읽힘. 쓴다면 「使いやすさの満足度」처럼 대상을 명시 (E22)",
  },
  {
    sample_id: "A11",
    action: "expert",
    findings: [
      finding("expert", "번들거림은 줄이고", "피지·번들거림 감소는 효능 범위 56항목에 없음. 메이크업 효과 등 다른 근거가 있는지 확인 필요", "F4.1 〔表3〕, F4.4 (01)", [
        pass("산뜻하게 수분을 채워주는 복합성 피부용 케어", "사용감 중심. E4: 「○○用」은 허용"),
      ]),
    ],
    ingredient_check: "복합성 라인은 개발 중. 피지 관련 성분·시험 자료 없음",
    translated_text: "テカリを減らし、水分を補う混合肌向けケア",
    back_translation_ko: "번들거림을 줄이고 수분을 보충하는 복합성 피부용 케어",
    localized_note: "「テカリ」는 일본 소비자에게 익숙한 단어. 「テカリを防ぐ」 계열은 메이크업 효과로 한정",
  },
  {
    sample_id: "A12",
    action: "should_fix",
    findings: [
      finding("should_fix", "무너진 피부 장벽을 되살리는", "회복·재생 표현은 의약품에 쓰는 말이라 화장품에 쓰지 않음", "E8 (03)", [
        pass("세라마이드와 지방산이 건조한 피부를 촉촉하게 지켜줍니다", "회복 대신 보습·보호 (효능 범위 (24)(27))"),
      ]),
    ],
    ingredient_check: "세라마이드 NP·스테아릭애씨드(지방산) 있음. 성분을 내세우므로 배합 목적도 필요 (E24)",
    translated_text: "セラミドと脂肪酸が、崩れた肌のバリアをよみがえらせるのを助けます",
    back_translation_ko: "세라마이드와 지방산이 무너진 피부 장벽을 되살아나게 돕습니다",
    localized_note: "「よみがえらせる」는 일본어에서 회복·재생 뉘앙스가 더 강함",
  },
  {
    sample_id: "A13",
    action: "must_fix",
    findings: [
      finding("must_fix", "단 3일 만에", "효과가 나타나는 기간을 정해 보증하는 표현", "F9.0, F7.2 (02)"),
      finding("must_fix", "완벽하게 복구합니다", "손상 회복을 단정하는 의약품적 표현", "E8 (03)", [
        pass("건조로 거칠어진 피부를 촉촉하게 가꿔줍니다", "기간·완전성 제거. 효능 범위 (22)(24)"),
      ]),
    ],
    ingredient_check: "보습 성분은 있으나 3일 내 복구를 뒷받침하는 자료 없음",
    translated_text: "たった3日で傷ついた肌のバリアを完璧に修復します",
    back_translation_ko: "단 3일 만에 상처 입은 피부 장벽을 완벽하게 수복합니다",
    localized_note: "「傷ついた」「修復」은 일본어에서 치료 뉘앙스가 강함",
  },
  {
    sample_id: "A14",
    action: "must_fix",
    findings: [
      finding("must_fix", "판매 1위", "순위는 객관적 조사와 출처(조사 회사·기간)가 있어야 함. 일본 출시 전이라 사실과도 맞지 않음", "F8.2 (02) / 景品表示法 第5条 (04)"),
      finding("must_fix", "단 하나의 선택", "최대급 표현", "F8.1 (02)", [pass("건조한 계절, 매일 쓰는 보습 스킨", "순위·최대급 제거")]),
    ],
    ingredient_check: "성분 언급 없음",
    translated_text: "日本の保湿化粧水販売1位！乾燥を終わらせる唯一の選択",
    back_translation_ko: "일본 보습 화장수 판매 1위! 건조를 끝내는 유일한 선택",
    localized_note: "「唯一の」는 일본 광고에서도 최대급 표현으로 읽힘",
  },
  {
    sample_id: "A15",
    action: "must_fix",
    findings: [
      finding("must_fix", "피부과 전문의가 강력 추천하는", "의사 등의 추천 광고는 사실이어도 불가. 사실이 아니면 薬機法 제66조 제2항", "F11.0, F11.2 (02) / E14 (03)"),
      finding("must_fix", "재생", "재생은 의약품에 쓰는 말", "E8 (03)", [pass("세라마이드를 담은 데일리 보습 에센스", "추천·재생 제거. 배합 목적은 E24대로 추가 필요")]),
    ],
    ingredient_check: "세라마이드 NP 있음. 전문가 추천 기록 없음",
    translated_text: "皮膚科専門医が強く推薦する肌のバリア再生エッセンス",
    back_translation_ko: "피부과 전문의가 강하게 추천하는 피부 장벽 재생 에센스",
    localized_note: "「強く」(강력)도 E5에서 원칙적으로 쓰지 않는 표현",
  },
  {
    sample_id: "A16",
    action: "must_fix",
    findings: [
      finding("must_fix", "무자극", "자극이 없다는 안전성 보증. 「테스트 완료」 표기는 데메리트 표시 등 조건이 필요", "F7.5 (02) / E2 (03)"),
      finding("must_fix", "부작용 걱정 없이", "누구에게나 안전하다는 보증 표현", "F7.0 (02)", [
        rework("(시험 후) 피부 자극성 테스트 완료. 모든 분에게 자극이 없는 것은 아닙니다", "E2 형식이지만 시험 결과가 생긴 뒤에만 가능"),
        pass("순한 사용감의 데일리 스킨", "안전 보증 대신 사용감 (F7.5: 강조 표현은 피함)"),
      ]),
    ],
    ingredient_check: "가상 자극 시험 T03 결과 미입력",
    translated_text: "無刺激テスト完了！誰でも副作用を心配せずに使用できます",
    back_translation_ko: "무자극 테스트 완료! 누구나 부작용을 걱정하지 않고 사용할 수 있습니다",
    localized_note: "일본 표기 예: 「皮膚刺激性テスト済み（全ての方に皮膚刺激が発生しないということではありません）」",
  },
  {
    sample_id: "A17",
    action: "must_fix",
    findings: [
      // 번역문 기준으로 잡힌 표현. 한국어 원문에는 없으므로 화면은 줄 전체 표시로 폴백한다
      finding("must_fix", "細胞からよみがえらせる", "세포 수준 표현은 화장품 정의·효능 범위를 벗어남 (번역문에서도 동일)", "E9 (03)"),
      finding("must_fix", "기적의", "효과를 강조하는 과장 표현", "F7.7 (02)", [pass("건조한 피부를 촉촉하게 채워주는 에센스", "세포·기적 표현 제거")]),
    ],
    ingredient_check: "세포 관련 자료 없음",
    translated_text: "たった1回の使用で肌の細胞からよみがえらせる奇跡のエッセンス",
    back_translation_ko: "단 1회 사용으로 피부 세포부터 되살리는 기적의 에센스",
    localized_note: "「奇跡の」는 일본 광고에서도 과장으로 읽힘",
  },
  {
    sample_id: "A18",
    action: "must_fix",
    findings: [
      finding("must_fix", "100%가", "조사 수치로 효능을 보증하는 표현", "E22 (03)"),
      finding("must_fix", "피부 트러블이 사라졌다고 증언", "효능에 관한 체험담은 불가", "F7.3 (02) / E20 (03)", [pass("매일 쓰기 좋은 촉촉한 사용감", "체험담·수치 제거. E20: 사용감 범위의 감상만 허용")]),
    ],
    ingredient_check: "트러블 관련 성분·시험 자료 없음",
    translated_text: "実際の使用者の100％が肌トラブルが消えたと証言しました",
    back_translation_ko: "실제 사용자의 100%가 피부 트러블이 사라졌다고 증언했습니다",
    localized_note: "「証言」은 일본어에서 체험담 광고 형식으로 바로 읽힘",
  },
  {
    sample_id: "A19",
    action: "must_fix",
    findings: [
      finding("must_fix", "여드름까지 치료하세요", "치료는 의약품에 쓰는 말. 효능 범위의 여드름 표현은 세안료의 (18)뿐", "E8 (03) / F4.1 〔表3〕 (01)"),
      finding("must_fix", "완벽하게 억제하고", "효과를 확실하다고 보증하는 표현", "F7.0 (02)", [pass("산뜻한 사용감을 위한 지성 피부용 스킨, 준비 중이에요", "치료·억제 제거. 출시 전 광고 시점은 별도 확인")]),
    ],
    ingredient_check: "지성 라인은 개발 중. 피지·여드름 관련 자료 없음",
    translated_text: "開発中の新商品で過剰な皮脂を完全に抑え、ニキビまで治療しましょう",
    back_translation_ko: "개발 중인 신상품으로 과도한 피지를 완전히 억제하고 여드름까지 치료합시다",
    localized_note: "「治療」는 일본어에서도 의약품 표현으로 바로 읽힘",
  },
  {
    sample_id: "A20",
    action: "must_fix",
    findings: [
      finding("must_fix", "모공을 완전히 닫고", "피부 구조를 바꾼다는 표현. 효능 범위 밖", "F4.1 〔表3〕 (01)"),
      finding("must_fix", "영구적으로 정상화하는", "효과의 지속을 보증하는 표현", "F9.0 (02)", [pass("유수분 밸런스를 생각한 복합성 피부용 스킨, 출시 소식 받기", "구조 변화·영구 표현 제거")]),
    ],
    ingredient_check: "복합성 라인은 개발 중. 관련 자료 없음",
    translated_text: "まもなく発売！毛穴を完全に閉じ、油水分バランスを永久に正常化する新商品",
    back_translation_ko: "곧 발매! 모공을 완전히 닫고 유수분 밸런스를 영구히 정상화하는 신상품",
    localized_note: "「永久に」는 일본어에서도 강한 보장 표현",
  },
];
