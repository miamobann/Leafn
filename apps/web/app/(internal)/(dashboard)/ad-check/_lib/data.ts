// 광고 검토 화면이 부르는 읽기 함수 (연습장 Suyeon-lab 전용).
// 정식 규칙은 "화면은 lib/data만 부른다"이지만, 공용 파일을 건드리지 않으려고 탭 안에 둔다.
// 정식 브랜치로 옮길 때 데이터는 lib/mock/, 함수는 lib/data/index.ts로 옮긴다.
import { parseAll, WORKSPACE_ID } from "@/lib/mock/helpers";
import { AdCheck } from "@/lib/schemas/ad-check";
import type { ReviewStatus } from "@/lib/schemas/common";
import { HISTORY_SEEDS } from "./history";
import { buildAdCheck, type SampleBook } from "./judge";
import { LAB_PRODUCTS, LabProduct } from "./products";
import { SAMPLE_COPIES, SAMPLE_JUDGMENTS, SampleCopy, SampleJudgment } from "./samples";

const products = parseAll(LabProduct, LAB_PRODUCTS, "ad-check/products");
const copies = parseAll(SampleCopy, SAMPLE_COPIES, "ad-check/samples");
const judgments = parseAll(SampleJudgment, SAMPLE_JUDGMENTS, "ad-check/judgments");
const book: SampleBook = { copies, judgments };

const checks = parseAll(
  AdCheck,
  HISTORY_SEEDS.map((seed) =>
    buildAdCheck({
      id: seed.id,
      workspaceId: WORKSPACE_ID,
      createdAt: seed.createdAt,
      lines: seed.sampleIds.map((id) => copies.find((c) => c.id === id)?.ko ?? id),
      productId: seed.productId,
      usage: seed.usage,
      book,
      review: seed.review,
    }),
  ),
  "ad-check/history",
);

// 잘못된 가짜 데이터는 빌드(정적 생성) 단계에서 걸리게 한다
function assertIntegrity(): void {
  const errors: string[] = [];
  const productIds = new Set(products.map((p) => p.id));
  const copyIds = new Set(copies.map((c) => c.id));
  for (const c of copies) {
    if (!productIds.has(c.product_id)) errors.push(`${c.id}: 없는 제품 ${c.product_id}`);
    if (!judgments.some((j) => j.sample_id === c.id)) errors.push(`${c.id}: 샘플 판정 없음`);
  }
  for (const j of judgments) {
    if (!copyIds.has(j.sample_id)) errors.push(`판정 ${j.sample_id}: 없는 샘플 문구`);
    if (j.action !== "ok" && j.findings.length === 0) errors.push(`판정 ${j.sample_id}: 위험 판정인데 근거 표현 없음`);
  }
  for (const seed of HISTORY_SEEDS) {
    if (!productIds.has(seed.productId)) errors.push(`${seed.id}: 없는 제품 ${seed.productId}`);
    for (const id of seed.sampleIds) if (!copyIds.has(id)) errors.push(`${seed.id}: 없는 샘플 문구 ${id}`);
  }
  if (errors.length > 0) throw new Error(`광고 검토 샘플 데이터 검사 실패: ${errors.join(", ")}`);
}

assertIntegrity();

export async function getLabProducts(): Promise<LabProduct[]> {
  return products;
}

export async function getSampleBook(): Promise<SampleBook> {
  return book;
}

export async function getLabAdChecks(opts: { status?: ReviewStatus; limit?: number } = {}): Promise<AdCheck[]> {
  const list = checks
    .filter((c) => !opts.status || c.review_status === opts.status)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return opts.limit ? list.slice(0, opts.limit) : list;
}

export async function getLabAdCheck(id: string): Promise<AdCheck | null> {
  return checks.find((c) => c.id === id) ?? null;
}
