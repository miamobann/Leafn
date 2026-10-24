import { CopyCandidate } from "@/lib/schemas/market";
import { parseAll, ts, WORKSPACE_ID } from "./helpers";

// 카피 후보 샘플 (AI가 수요-공급 빈칸·AI 검색 결정 키워드와 자사 전성분으로 만들었다고 가정).
// 자사 전성분·스펙으로 사실인 것만 쓴다 (景表法). 성분을 특기하면 배합 목적을 함께 (F5.5). 모두 약기법 검토 전
// [id, 카테고리, 후보 영역, 자사 제품, 카피, 해석, 재료, 사용 위치, 배합 목적, 지표, 측정 방법]
type Seed = [string, string, string, string, string, string, string[], CopyCandidate["placements"], string | null, string, string];

const SEEDS: Seed[] = [
  ["cc-1", "化粧水", "z-toner-light", "p-own-1", "ベタつかない、みずみずしい使い心地。ヒアルロン酸Na（保湿成分）が肌にうるおいを与えます。", "끈적이지 않는 산뜻한 사용감. 히알루론산Na(보습 성분)가 피부에 수분을 줍니다.", ["ベタつかない", "ヒアルロン酸", "保湿"], ["detail_page", "ad"], "保湿成分", "광고 클릭률(CTR)", "광고 소재 A/B (지금 소재 vs 이 카피)"],
  ["cc-2", "化粧水", "z-toner-light", "p-own-1", "エタノール不使用のアルコールフリー化粧水です。", "에탄올을 쓰지 않은 무알코올 화장수입니다.", ["アルコールフリー"], ["qa", "detail_page"], null, "상세페이지 전환율", "게재 전후 2주 기간 비교"],
  ["cc-3", "化粧水", "z-toner-value", "p-own-1", "200mL入り。毎日たっぷり使える化粧水。", "200mL. 매일 듬뿍 쓸 수 있는 화장수.", ["大容量"], ["product_name", "ad"], null, "광고 클릭률(CTR)", "광고 소재 A/B (용량 강조 vs 성분 강조)"],
  ["cc-4", "美容液", "z-serum-dry", "p-own-2", "乾燥しがちな肌に。2種のヒアルロン酸（保湿成分）配合で肌の乾燥を防ぎます。", "건조해지기 쉬운 피부에. 2종의 히알루론산(보습 성분) 배합으로 피부 건조를 막아 줍니다.", ["乾燥", "ヒアルロン酸"], ["detail_page", "ad"], "保湿成分", "상세페이지 전환율", "게재 전후 2주 기간 비교"],
];

export const copyCandidates = parseAll(
  CopyCandidate,
  SEEDS.map(([id, category, zone_id, own_product_id, copy_ja, copy_ko, materials, placements, ingredient_purpose, metric, method]) => ({
    id,
    workspace_id: WORKSPACE_ID,
    created_at: ts("2026-10-21", "11:00"),
    category,
    zone_id,
    own_product_id,
    copy_ja,
    copy_ko,
    materials,
    placements,
    ingredient_purpose,
    verification: { metric, method },
    model: "gpt-4.1-mini",
    prompt_version: "copy-candidates.v1 (샘플)",
  })),
  "copyCandidates",
);
