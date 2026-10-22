// 테스트 광고 문구 A01~A20과 샘플 판정 (모두 가상 데이터).
// 문구 출처: 팀이 만든 leaf_and_japan_marketing_test_data.csv
// 샘플 판정은 실제 AI 출력이 아니라 화면 확인용으로 쓴 것이다.
// 기준 자료(knowledge/yakkiho/)가 확정되기 전이라 근거는 모두 "자료 확인 필요"로 둔다.
import type { Finding, SampleCopy, SampleJudgment, Suggestion } from "./types";

const BASIS_EFFICACY = "化粧品の効能の範囲 (기준 자료 대조 필요)";
const BASIS_GUIDELINE = "化粧品等の適正広告ガイドライン (기준 자료 대조 필요)";
const BASIS_NONE = "기준 자료 없음 — 담당자·전문가 확인";

function finding(text: string, reason: string, basis: string): Finding {
  return { text, start: null, end: null, reason, basis, basisStatus: "자료 확인 필요" };
}

function pass(text: string, recheckReason: string): Suggestion {
  return { text, recheck: "통과", recheckReason };
}

function retry(text: string, recheckReason: string): Suggestion {
  return { text, recheck: "재수정 필요", recheckReason };
}

export const SAMPLE_COPIES: SampleCopy[] = [
  { id: "A01", productId: "dry-skin", usage: "상세페이지", ko: "히알루론산과 글리세린으로 피부를 촉촉하게 가꿔주는 데일리 스킨", jaLiteral: "ヒアルロン酸とグリセリンで肌をしっとり整えるデイリーローション", intentHypothesis: "안전한 표현", evidenceStatus: "일부" },
  { id: "A02", productId: "dry-essence", usage: "SNS", ko: "세라마이드와 콜레스테롤을 담아 건조한 피부를 위한 보습 케어", jaLiteral: "セラミドとコレステロールを配合し、乾燥した肌のための保湿ケア", intentHypothesis: "안전한 표현", evidenceStatus: "일부" },
  { id: "A03", productId: "dry-skin", usage: "광고 배너", ko: "매일 아침저녁, 촉촉한 피부를 위한 첫 번째 습관", jaLiteral: "毎朝晩、しっとりした肌のための最初の習慣", intentHypothesis: "안전한 표현", evidenceStatus: "없음" },
  { id: "A04", productId: "dry-essence", usage: "상세페이지", ko: "히알루론산과 피부 보습 성분으로 매끄러운 피부결을 가꿔보세요", jaLiteral: "ヒアルロン酸と肌の保湿成分で、なめらかな肌のキメを整えましょう", intentHypothesis: "안전한 표현", evidenceStatus: "일부" },
  { id: "A05", productId: "oily-skin", usage: "SNS", ko: "판테놀과 녹차추출물을 담은 산뜻한 스킨케어, 곧 만나요", jaLiteral: "パンテノールとチャ葉エキスを配合したさっぱりしたスキンケア、もうすぐ登場", intentHypothesis: "안전한 표현", evidenceStatus: "일부" },
  { id: "A06", productId: "combo-skin", usage: "알림받기 버튼", ko: "히알루론산과 베타인을 담은 신제품 소식 가장 먼저 받기", jaLiteral: "ヒアルロン酸とベタインを配合した新商品の情報をいち早く受け取る", intentHypothesis: "안전한 표현", evidenceStatus: "일부" },
  { id: "A07", productId: "dry-essence", usage: "상세페이지", ko: "한 번의 사용으로 건조함을 완전히 해결하는 집중 에센스", jaLiteral: "1回の使用で乾燥を完全に解決する集中エッセンス", intentHypothesis: "경계선 표현", evidenceStatus: "없음" },
  { id: "A08", productId: "dry-skin", usage: "SNS", ko: "히알루론산이 피부 속 깊이 스며들어 수분을 꽉 채워줍니다", jaLiteral: "ヒアルロン酸が肌の奥深くまで浸透し、水分をたっぷり満たします", intentHypothesis: "경계선 표현", evidenceStatus: "없음" },
  { id: "A09", productId: "dry-essence", usage: "광고 배너", ko: "피부 장벽을 강화하는 세라마이드 보습 솔루션", jaLiteral: "肌のバリアを強化するセラミド保湿ソリューション", intentHypothesis: "경계선 표현", evidenceStatus: "없음" },
  { id: "A10", productId: "dry-skin", usage: "설문 결과 페이지", ko: "응답자의 95%가 사용 후 촉촉함에 만족했다고 답했습니다", jaLiteral: "回答者の95％が使用後のうるおいに満足したと答えました", intentHypothesis: "경계선 표현", evidenceStatus: "없음" },
  { id: "A11", productId: "combo-skin", usage: "상세페이지", ko: "번들거림은 줄이고 수분은 채워주는 복합성 피부 맞춤 케어", jaLiteral: "テカリを減らし、水分を補う混合肌向けケア", intentHypothesis: "경계선 표현", evidenceStatus: "없음" },
  { id: "A12", productId: "dry-essence", usage: "SNS", ko: "세라마이드와 지방산이 무너진 피부 장벽을 되살리는 데 도움을 줍니다", jaLiteral: "セラミドと脂肪酸が、崩れた肌のバリアをよみがえらせるのを助けます", intentHypothesis: "경계선 표현", evidenceStatus: "없음" },
  { id: "A13", productId: "dry-essence", usage: "상세페이지", ko: "단 3일 만에 손상된 피부 장벽을 완벽하게 복구합니다", jaLiteral: "たった3日で傷ついた肌のバリアを完璧に修復します", intentHypothesis: "과장·위험 가능 표현", evidenceStatus: "없음" },
  { id: "A14", productId: "dry-skin", usage: "광고 배너", ko: "일본 보습 스킨 판매 1위! 건조함을 끝내는 단 하나의 선택", jaLiteral: "日本の保湿化粧水販売1位！乾燥を終わらせる唯一の選択", intentHypothesis: "과장·위험 가능 표현", evidenceStatus: "없음" },
  { id: "A15", productId: "dry-essence", usage: "SNS", ko: "피부과 전문의가 강력 추천하는 피부 장벽 재생 에센스", jaLiteral: "皮膚科専門医が強く推薦する肌のバリア再生エッセンス", intentHypothesis: "과장·위험 가능 표현", evidenceStatus: "없음" },
  { id: "A16", productId: "dry-skin", usage: "상세페이지", ko: "무자극 테스트 완료! 누구나 부작용 걱정 없이 사용할 수 있습니다", jaLiteral: "無刺激テスト完了！誰でも副作用を心配せずに使用できます", intentHypothesis: "과장·위험 가능 표현", evidenceStatus: "없음" },
  { id: "A17", productId: "dry-essence", usage: "광고 배너", ko: "단 한 번의 사용으로 피부 속 세포부터 되살리는 기적의 에센스", jaLiteral: "たった1回の使用で肌の細胞からよみがえらせる奇跡のエッセンス", intentHypothesis: "과장·위험 가능 표현", evidenceStatus: "없음" },
  { id: "A18", productId: "dry-skin", usage: "설문 결과 페이지", ko: "실제 사용자의 100%가 피부 트러블이 사라졌다고 증언했습니다", jaLiteral: "実際の使用者の100％が肌トラブルが消えたと証言しました", intentHypothesis: "과장·위험 가능 표현", evidenceStatus: "없음" },
  { id: "A19", productId: "oily-skin", usage: "SNS", ko: "개발 중인 신제품으로 과도한 피지를 완벽하게 억제하고 여드름까지 치료하세요", jaLiteral: "開発中の新商品で過剰な皮脂を完全に抑え、ニキビまで治療しましょう", intentHypothesis: "과장·위험 가능 표현", evidenceStatus: "없음" },
  { id: "A20", productId: "combo-skin", usage: "알림받기 버튼", ko: "곧 출시! 모공을 완전히 닫고 유수분 밸런스를 영구적으로 정상화하는 신제품", jaLiteral: "まもなく発売！毛穴を完全に閉じ、油水分バランスを永久に正常化する新商品", intentHypothesis: "과장·위험 가능 표현", evidenceStatus: "없음" },
];

export const SAMPLE_JUDGMENTS: SampleJudgment[] = [
  {
    sampleId: "A01",
    action: "ok",
    findings: [],
    ingredientCheck: "히알루론산나트륨·글리세린 모두 전성분에 있음",
    suggestions: [],
    translatedText: "ヒアルロン酸とグリセリンで肌をしっとり整えるデイリーローション",
    backTranslationKo: "히알루론산과 글리세린으로 피부를 촉촉하게 정돈하는 데일리 로션",
    localizedNote: "「しっとり整える」는 일본 화장수 광고에서 흔하고 자연스러운 표현",
  },
  {
    sampleId: "A02",
    action: "ok",
    findings: [],
    ingredientCheck: "세라마이드 NP·콜레스테롤 모두 전성분에 있음",
    suggestions: [],
    translatedText: "セラミドとコレステロールを配合し、乾燥した肌のための保湿ケア",
    backTranslationKo: "세라마이드와 콜레스테롤을 배합한, 건조한 피부를 위한 보습 케어",
    localizedNote: "「乾燥した肌のための」보다 「乾燥肌のための」가 더 자연스러움",
  },
  {
    sampleId: "A03",
    action: "ok",
    findings: [],
    ingredientCheck: "성분·효능 언급 없음",
    suggestions: [],
    translatedText: "毎朝晩、しっとりした肌のための最初の習慣",
    backTranslationKo: "매일 아침저녁, 촉촉한 피부를 위한 첫 습관",
    localizedNote: "「最初の習慣」은 직역 느낌. 「毎日のうるおい習慣」 정도가 자연스러움",
  },
  {
    sampleId: "A04",
    action: "ok",
    findings: [],
    ingredientCheck: "히알루론산나트륨 있음. '피부 보습 성분'은 어떤 성분인지 특정하면 더 명확함",
    suggestions: [],
    translatedText: "ヒアルロン酸と肌の保湿成分で、なめらかな肌のキメを整えましょう",
    backTranslationKo: "히알루론산과 피부 보습 성분으로 매끄러운 피부결을 정돈하세요",
    localizedNote: "「キメを整える」는 일본 화장품 광고에서 자주 쓰는 표현 (효능 범위 대조 필요)",
  },
  {
    sampleId: "A05",
    action: "expert",
    findings: [
      finding(
        "곧 만나요",
        "출시 전 제품을 미리 알리는 문구. 제품 구분과 일본 판매 절차가 미정이라 광고 가능 시점 확인이 필요",
        BASIS_NONE,
      ),
    ],
    ingredientCheck: "판테놀·녹차추출물은 개발 중 처방 기준. 처방 확정 전",
    suggestions: [pass("산뜻한 사용감의 스킨케어를 준비하고 있어요", "성분 효능 언급 없이 출시 준비 사실만 전달")],
    translatedText: "パンテノールとチャ葉エキスを配合したさっぱりしたスキンケア、もうすぐ登場",
    backTranslationKo: "판테놀과 녹차잎 추출물을 배합한 산뜻한 스킨케어, 곧 등장",
    localizedNote: "「もうすぐ登場」은 자연스러움. 출시 시기가 정해지면 함께 표기",
  },
  {
    sampleId: "A06",
    action: "expert",
    findings: [
      finding(
        "신제품 소식 가장 먼저 받기",
        "알림 신청 시 이메일 등 개인정보를 받으면 일본 개인정보보호법(APPI) 동의·이용 목적 고지가 필요할 수 있음 (약기법 외 항목)",
        BASIS_NONE,
      ),
    ],
    ingredientCheck: "히알루론산나트륨·베타인은 개발 중 처방 기준. 처방 확정 전",
    suggestions: [pass("신제품 출시 소식 받기", "성분 언급을 빼고 알림 기능만 전달. 개인정보 동의 문구는 별도 확인")],
    translatedText: "ヒアルロン酸とベタインを配合した新商品の情報をいち早く受け取る",
    backTranslationKo: "히알루론산과 베타인을 배합한 신상품 정보를 가장 빨리 받기",
    localizedNote: "버튼 문구로는 「新商品のお知らせを受け取る」처럼 짧게 하는 편이 일반적",
  },
  {
    sampleId: "A07",
    action: "must_fix",
    findings: [
      finding("한 번의 사용으로", "1회 사용만으로 효과가 나타난다는 즉효성 표현", BASIS_GUIDELINE),
      finding("완전히 해결하는", "효과를 완전·확실하다고 단정하는 표현", BASIS_GUIDELINE),
    ],
    ingredientCheck: "보습 성분은 있으나 '완전 해결'을 뒷받침하는 시험 결과 없음",
    suggestions: [
      pass("건조한 피부에 집중 보습을 더하는 에센스", "효과 단정 없이 보습 사용 목적만 표현"),
      retry("한 번만 써도 촉촉함이 느껴지는 에센스", "사용감 표현이지만 '한 번만'이 즉효로 읽힐 수 있음"),
    ],
    translatedText: "1回の使用で乾燥を完全に解決する集中エッセンス",
    backTranslationKo: "1회 사용으로 건조를 완전히 해결하는 집중 에센스",
    localizedNote: "일본어에서도 「完全に解決」은 강한 단정으로 읽힘",
  },
  {
    sampleId: "A08",
    action: "should_fix",
    findings: [
      finding(
        "피부 속 깊이 스며들어",
        "침투 표현은 범위를 한정해 표기해야 할 수 있음 (예: 각질층까지)",
        BASIS_GUIDELINE,
      ),
    ],
    ingredientCheck: "히알루론산나트륨 있음. 침투 깊이를 보여주는 자료 없음",
    suggestions: [pass("히알루론산이 각질층까지 스며들어 촉촉함을 채워줍니다", "침투 범위를 각질층으로 한정")],
    translatedText: "ヒアルロン酸が肌の奥深くまで浸透し、水分をたっぷり満たします",
    backTranslationKo: "히알루론산이 피부 안쪽 깊은 곳까지 침투해 수분을 듬뿍 채웁니다",
    localizedNote: "「奥深くまで浸透」은 한국어보다 강하게 읽힘. 「角質層まで浸透」처럼 한정하는 표현이 일본에서 흔함",
  },
  {
    sampleId: "A09",
    action: "should_fix",
    findings: [
      finding("피부 장벽을 강화하는", "피부 기능을 바꾼다는 인상을 줄 수 있어 효능 범위 대조가 필요", BASIS_EFFICACY),
    ],
    ingredientCheck: "세라마이드 NP 있음. 장벽 관련 시험 결과 없음",
    suggestions: [pass("건조로부터 피부를 보호하는 세라마이드 보습", "보호·보습 사용 목적 중심으로 표현 (효능 범위 대조 필요)")],
    translatedText: "肌のバリアを強化するセラミド保湿ソリューション",
    backTranslationKo: "피부 장벽을 강화하는 세라마이드 보습 솔루션",
    localizedNote: "「ソリューション」은 일본 화장품 광고에서 다소 딱딱한 인상",
  },
  {
    sampleId: "A10",
    action: "must_fix",
    findings: [
      finding("응답자의 95%가", "수치를 뒷받침하는 조사 원자료가 없음 (가상 시험 T02 결과 미입력)", BASIS_GUIDELINE),
    ],
    ingredientCheck: "성분 언급 없음",
    suggestions: [
      pass("촉촉한 사용감을 원하는 분께 추천하는 스킨", "수치 없이 사용감 중심으로 표현"),
      retry("(조사 결과 확보 후) 조사 기간·대상·인원을 함께 표기", "원자료가 생긴 뒤에만 쓸 수 있음"),
    ],
    translatedText: "回答者の95％が使用後のうるおいに満足したと答えました",
    backTranslationKo: "응답자의 95%가 사용 후 촉촉함에 만족했다고 답했습니다",
    localizedNote: "일본에서는 만족도 수치 옆에 조사 조건(※)을 작게 다는 형식이 일반적",
  },
  {
    sampleId: "A11",
    action: "expert",
    findings: [
      finding("번들거림은 줄이고", "피지·번들거림 관련 표현이 효능 범위에 해당하는지 기준 자료 대조 필요", BASIS_EFFICACY),
    ],
    ingredientCheck: "복합성 라인은 개발 중. 피지 관련 성분·시험 자료 없음",
    suggestions: [pass("산뜻하게 수분을 채워주는 복합성 피부용 케어", "피지 변화 대신 사용감 중심으로 표현")],
    translatedText: "テカリを減らし、水分を補う混合肌向けケア",
    backTranslationKo: "번들거림을 줄이고 수분을 보충하는 복합성 피부용 케어",
    localizedNote: "「テカリ」는 일본 소비자에게 익숙한 단어",
  },
  {
    sampleId: "A12",
    action: "should_fix",
    findings: [
      finding("무너진 피부 장벽을 되살리는", "손상 회복·재생을 연상시켜 의약품적 효과로 읽힐 수 있음", BASIS_GUIDELINE),
    ],
    ingredientCheck: "세라마이드 NP·스테아릭애씨드(지방산) 있음. 장벽 회복 시험 결과 없음",
    suggestions: [pass("세라마이드와 지방산이 건조한 피부를 촉촉하게 지켜줍니다", "회복 대신 보습·보호 표현")],
    translatedText: "セラミドと脂肪酸が、崩れた肌のバリアをよみがえらせるのを助けます",
    backTranslationKo: "세라마이드와 지방산이 무너진 피부 장벽을 되살아나게 돕습니다",
    localizedNote: "「よみがえらせる」는 일본어에서 회복·재생 뉘앙스가 더 강함",
  },
  {
    sampleId: "A13",
    action: "must_fix",
    findings: [
      finding("단 3일 만에", "기간을 정해 효과를 보장하는 표현", BASIS_GUIDELINE),
      finding("완벽하게 복구합니다", "손상 회복을 단정하는 의약품적 표현", BASIS_EFFICACY),
    ],
    ingredientCheck: "보습 성분은 있으나 3일 내 복구를 뒷받침하는 자료 없음",
    suggestions: [pass("건조로 거칠어진 피부를 촉촉하게 가꿔줍니다", "기간·완전성 표현 제거")],
    translatedText: "たった3日で傷ついた肌のバリアを完璧に修復します",
    backTranslationKo: "단 3일 만에 상처 입은 피부 장벽을 완벽하게 수복합니다",
    localizedNote: "「傷ついた」「修復」은 일본어에서 치료 뉘앙스가 강함",
  },
  {
    sampleId: "A14",
    action: "must_fix",
    findings: [
      finding("판매 1위", "순위 근거 자료 없음 (가상 조사 T05 결과 미입력)", BASIS_GUIDELINE),
      finding("단 하나의 선택", "다른 제품보다 우월하다는 최상급 표현", BASIS_GUIDELINE),
    ],
    ingredientCheck: "성분 언급 없음",
    suggestions: [pass("건조한 계절, 매일 쓰는 보습 스킨", "순위·최상급 표현 제거")],
    translatedText: "日本の保湿化粧水販売1位！乾燥を終わらせる唯一の選択",
    backTranslationKo: "일본 보습 화장수 판매 1위! 건조를 끝내는 유일한 선택",
    localizedNote: "일본 출시 전 제품에 '일본 판매 1위'는 사실과도 맞지 않음",
  },
  {
    sampleId: "A15",
    action: "must_fix",
    findings: [
      finding("피부과 전문의가 강력 추천하는", "의사·전문가 추천 형식의 표현", BASIS_GUIDELINE),
      finding("재생", "재생은 의약품적 효과를 연상시킴", BASIS_EFFICACY),
    ],
    ingredientCheck: "세라마이드 NP 있음. 전문가 추천 기록 없음",
    suggestions: [pass("세라마이드를 담은 데일리 보습 에센스", "추천·재생 표현 제거")],
    translatedText: "皮膚科専門医が強く推薦する肌のバリア再生エッセンス",
    backTranslationKo: "피부과 전문의가 강하게 추천하는 피부 장벽 재생 에센스",
    localizedNote: "일본어로도 의사 추천 형식은 그대로 문제가 될 수 있음",
  },
  {
    sampleId: "A16",
    action: "must_fix",
    findings: [
      finding("무자극", "자극이 전혀 없다는 안전성 보증 표현", BASIS_GUIDELINE),
      finding("부작용 걱정 없이", "부작용이 없다는 안전성 보증 표현", BASIS_GUIDELINE),
    ],
    ingredientCheck: "가상 자극 시험 T03 결과 미입력",
    suggestions: [
      pass("순한 사용감의 데일리 스킨", "사용감 표현으로 한정 (기준 자료 대조 필요)"),
      retry("(시험 결과 확보 후) 패치 테스트 완료. 모든 분에게 자극이 없는 것은 아닙니다", "시험 결과가 생긴 뒤에만 쓸 수 있음"),
    ],
    translatedText: "無刺激テスト完了！誰でも副作用を心配せずに使用できます",
    backTranslationKo: "무자극 테스트 완료! 누구나 부작용을 걱정하지 않고 사용할 수 있습니다",
    localizedNote: "일본에서는 테스트 완료 표기 옆에 「すべての方に刺激が起こらないわけではありません」 주석을 다는 형식이 흔함",
  },
  {
    sampleId: "A17",
    action: "must_fix",
    findings: [
      // 번역문 기준으로 잡힌 표현 예시. 한국어 원문에는 없으므로 화면은 줄 단위 표시로 폴백한다
      finding("細胞からよみがえらせる", "세포 수준의 재생을 말하는 의약품적 표현 (번역문에서도 동일)", BASIS_EFFICACY),
      finding("기적의", "효과를 과장하는 표현", BASIS_GUIDELINE),
    ],
    ingredientCheck: "세포 재생 관련 시험 자료 없음",
    suggestions: [pass("건조한 피부를 촉촉하게 채워주는 에센스", "재생·기적 표현 제거")],
    translatedText: "たった1回の使用で肌の細胞からよみがえらせる奇跡のエッセンス",
    backTranslationKo: "단 1회 사용으로 피부 세포부터 되살리는 기적의 에센스",
    localizedNote: "「奇跡の」는 일본 광고에서도 과장으로 읽힘",
  },
  {
    sampleId: "A18",
    action: "must_fix",
    findings: [
      finding("100%가", "수치 근거 원자료 없음", BASIS_GUIDELINE),
      finding("피부 트러블이 사라졌다고 증언", "체험담 형식으로 트러블 개선 효과를 말하는 표현", BASIS_GUIDELINE),
    ],
    ingredientCheck: "트러블 관련 성분·시험 자료 없음",
    suggestions: [pass("매일 쓰기 좋은 촉촉한 사용감", "체험담·수치 표현 제거")],
    translatedText: "実際の使用者の100％が肌トラブルが消えたと証言しました",
    backTranslationKo: "실제 사용자의 100%가 피부 트러블이 사라졌다고 증언했습니다",
    localizedNote: "「証言」은 일본어에서 체험담 광고 형식으로 바로 읽힘",
  },
  {
    sampleId: "A19",
    action: "must_fix",
    findings: [
      finding("여드름까지 치료하세요", "치료는 의약품의 효능 표현", BASIS_EFFICACY),
      finding("완벽하게 억제하고", "효과를 완전하다고 단정하는 표현", BASIS_GUIDELINE),
    ],
    ingredientCheck: "지성 라인은 개발 중. 피지·여드름 관련 시험 자료 없음",
    suggestions: [pass("산뜻한 사용감을 위한 지성 피부용 스킨, 준비 중이에요", "치료·억제 표현 제거. 출시 전 광고 시점은 별도 확인")],
    translatedText: "開発中の新商品で過剰な皮脂を完全に抑え、ニキビまで治療しましょう",
    backTranslationKo: "개발 중인 신상품으로 과도한 피지를 완전히 억제하고 여드름까지 치료합시다",
    localizedNote: "「治療」는 일본어에서도 의약품 표현으로 바로 읽힘",
  },
  {
    sampleId: "A20",
    action: "must_fix",
    findings: [
      finding("모공을 완전히 닫고", "피부 구조를 바꾼다는 단정 표현", BASIS_EFFICACY),
      finding("영구적으로 정상화하는", "효과의 영구성을 보장하는 표현", BASIS_GUIDELINE),
    ],
    ingredientCheck: "복합성 라인은 개발 중. 관련 시험 자료 없음",
    suggestions: [pass("유수분 밸런스를 생각한 복합성 피부용 스킨, 출시 소식 받기", "구조 변화·영구 표현 제거")],
    translatedText: "まもなく発売！毛穴を完全に閉じ、油水分バランスを永久に正常化する新商品",
    backTranslationKo: "곧 발매! 모공을 완전히 닫고 유수분 밸런스를 영구히 정상화하는 신상품",
    localizedNote: "「永久に」는 일본어에서도 강한 보장 표현",
  },
];
