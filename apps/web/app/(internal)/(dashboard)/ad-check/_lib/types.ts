// 광고 검토(TAB 3) 데이터 모양.
// CLAUDE.md 5장 ad_checks, 7장 약기법 응답 JSON을 기준으로 하고,
// docs/prototype-plan.md 8장 제안(start/end, final_text, product_category, usage, 번역·역번역)을 반영했다.
// Zod 도입 전이라 TypeScript 타입 + mock 검사(mock.ts의 assertMockIntegrity)로 대신한다.

/** 행동 기준 4단계. 위험도 이름 대신 "무엇을 해야 하는지"로 판정한다 */
export const ACTIONS = ["must_fix", "should_fix", "expert", "ok"] as const;
export type Action = (typeof ACTIONS)[number];

/** 검토 상태. "승인"이라는 말은 법적 승인으로 오해될 수 있어 쓰지 않는다 */
export const REVIEW_STATUSES = ["pending", "internal_done", "rejected", "expert_requested"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const USAGES = ["상세페이지", "SNS", "광고 배너", "설문 결과 페이지", "알림받기 버튼"] as const;
export type Usage = (typeof USAGES)[number];

export type ProductCategory = "一般化粧品" | "医薬部外品" | "미정";
export type InputLang = "ko" | "ja";

export type Ingredient = {
  ko: string;
  inci: string;
  /** 일본어 표시명(가칭). 확인 전 */
  ja: string;
};

export type Product = {
  id: string;
  nameKo: string;
  nameJa: string;
  line: string;
  launchStatus: "출시" | "개발 중";
  category: ProductCategory;
  volume: string;
  container: string;
  ingredients: Ingredient[];
};

export type Finding = {
  /** 원문 안의 위험 표현 */
  text: string;
  /** 원문 내 위치. 확실할 때만 넣고, 없거나 틀리면 화면이 줄 단위 표시로 폴백한다 */
  start: number | null;
  end: number | null;
  reason: string;
  basis: string;
  basisStatus: "자료 확인됨" | "자료 확인 필요";
};

export type Suggestion = {
  text: string;
  /** 대체 표현도 같은 기준으로 다시 검토한 결과 */
  recheck: "통과" | "재수정 필요";
  recheckReason: string;
};

export type LineResult = {
  lineIndex: number;
  original: string;
  inputLang: InputLang;
  action: Action;
  findings: Finding[];
  /** 전성분과 문구의 성분·효능 일치 여부 */
  ingredientCheck: string;
  suggestions: Suggestion[];
  /** 한국어 입력일 때만 */
  translatedText: string | null;
  backTranslationKo: string | null;
  localizedNote: string;
  /** 샘플 판정의 기준 제품. 선택한 제품과 다르면 화면에 안내한다 */
  sampleProductId: string | null;
  sampleId: string | null;
};

/** 테스트용 광고 문구 (CSV A01~A20). intentHypothesis는 정답이 아니라 작성 의도(가설) */
export type SampleCopy = {
  id: string;
  productId: string;
  usage: Usage;
  ko: string;
  jaLiteral: string;
  intentHypothesis: "안전한 표현" | "경계선 표현" | "과장·위험 가능 표현";
  evidenceStatus: "있음" | "일부" | "없음";
};

/** 샘플 판정. 실제 AI 출력이 아니다 */
export type SampleJudgment = Omit<
  LineResult,
  "lineIndex" | "original" | "inputLang" | "sampleProductId" | "sampleId"
> & { sampleId: string };

export type AdCheck = {
  id: string;
  productId: string;
  usage: Usage;
  createdAt: string;
  requester: string;
  reviewer: string | null;
  status: ReviewStatus;
  /** 샘플 문구 ID 목록. 화면에서 판정으로 풀어 쓴다 */
  sampleIds: string[];
  finalText: string;
  reviewerNote: string;
  model: string;
  promptVersion: string;
};

export type ResolvedAdCheck = Omit<AdCheck, "sampleIds"> & {
  productName: string;
  lines: LineResult[];
  overallAction: Action;
};
