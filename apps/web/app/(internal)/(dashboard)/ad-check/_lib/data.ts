// 광고 검토 화면이 부르는 읽기 함수. 지금은 mock을 돌려주고, 나중에 같은 시그니처의 Supabase 쿼리로 바꾼다.
// 화면은 mock 파일을 직접 import하지 않고 이 파일만 부른다 (docs/CODING_RULES.md 5장).
import { judgeLine, overallAction } from "./judge";
import { SAMPLE_COPIES, SAMPLE_JUDGMENTS } from "./mock-copies";
import { MOCK_AD_CHECKS } from "./mock-history";
import { MOCK_PRODUCTS } from "./mock-products";
import type { Product, ResolvedAdCheck, ReviewStatus, SampleCopy, SampleJudgment } from "./types";

// 잘못된 가짜 데이터는 빌드(정적 생성) 단계에서 걸리게 한다
function assertMockIntegrity(): void {
  const errors: string[] = [];
  const productIds = new Set(MOCK_PRODUCTS.map((p) => p.id));
  const copyIds = new Set(SAMPLE_COPIES.map((c) => c.id));
  const judgedIds = new Set(SAMPLE_JUDGMENTS.map((j) => j.sampleId));

  if (productIds.size !== MOCK_PRODUCTS.length) errors.push("제품 ID 중복");
  if (copyIds.size !== SAMPLE_COPIES.length) errors.push("샘플 문구 ID 중복");
  for (const copy of SAMPLE_COPIES) {
    if (!productIds.has(copy.productId)) errors.push(`${copy.id}: 없는 제품 ${copy.productId}`);
    if (!judgedIds.has(copy.id)) errors.push(`${copy.id}: 샘플 판정 없음`);
  }
  for (const judgment of SAMPLE_JUDGMENTS) {
    if (!copyIds.has(judgment.sampleId)) errors.push(`판정 ${judgment.sampleId}: 없는 샘플 문구`);
    if (judgment.action !== "ok" && judgment.findings.length === 0) {
      errors.push(`판정 ${judgment.sampleId}: 위험 판정인데 근거 표현 없음`);
    }
  }
  for (const check of MOCK_AD_CHECKS) {
    if (!productIds.has(check.productId)) errors.push(`${check.id}: 없는 제품 ${check.productId}`);
    for (const id of check.sampleIds) {
      if (!copyIds.has(id)) errors.push(`${check.id}: 없는 샘플 문구 ${id}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`광고 검토 샘플 데이터 검사 실패: ${errors.join(", ")}`);
  }
}

assertMockIntegrity();

export async function getAdCheckProducts(): Promise<Product[]> {
  return MOCK_PRODUCTS;
}

export async function getSampleCopies(): Promise<SampleCopy[]> {
  return SAMPLE_COPIES;
}

export async function getSampleJudgments(): Promise<SampleJudgment[]> {
  return SAMPLE_JUDGMENTS;
}

export async function getAdChecks(options: { status?: ReviewStatus; limit?: number } = {}): Promise<ResolvedAdCheck[]> {
  const resolved = MOCK_AD_CHECKS.filter((check) => !options.status || check.status === options.status)
    .map(({ sampleIds, ...check }): ResolvedAdCheck => {
      const lines = sampleIds.map((id, index) => {
        // 무결성 검사를 통과했으므로 항상 있다
        const copy = SAMPLE_COPIES.find((c) => c.id === id) as SampleCopy;
        return judgeLine(copy.ko, index + 1, SAMPLE_COPIES, SAMPLE_JUDGMENTS);
      });
      const product = MOCK_PRODUCTS.find((p) => p.id === check.productId);
      return { ...check, productName: product?.nameKo ?? check.productId, lines, overallAction: overallAction(lines) };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return options.limit ? resolved.slice(0, options.limit) : resolved;
}
