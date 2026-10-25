import Link from "next/link";
import { ViewStateGate } from "@/components/common/view-state";
import { getProducts } from "@/lib/data";
import { getCollectionOwnProducts } from "@/lib/data/collection";
import { getImportOwnProducts } from "@/lib/data/review-import-actions";
import { PlatformCollect } from "./collect-panel";
import { CsvImport } from "./csv-import";
import { type CompetitorTab, ImportSwitch, type ImportType, moveLinkClass } from "./import-parts";
import { OwnReviewImport } from "./own-review-import";

// 리뷰 가져오기. 첫 갈림길은 우리 제품 리뷰(국내 CSV) | 경쟁 제품 리뷰(일본), 경쟁 쪽은 그 안에서 Qoo10 자동 | CSV.
// 주소: ?type=own|competitor · ?tab=csv (경쟁 쪽) · ?product=<우리 제품 id> (리포트에서 누른 제품. 갈림길을 옮겨도 이어진다)
type SearchParams = Promise<{ type?: string; tab?: string; product?: string }>;

export default async function ReviewsImportPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const type: ImportType = params.type === "competitor" ? "competitor" : "own";
  const tab: CompetitorTab = params.tab === "csv" ? "csv" : "auto";
  const product = params.product?.trim() || null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1.5">
        <Link href="/reviews" className={`${moveLinkClass} text-[13px] font-normal`}>
          ← 리뷰 리포트로
        </Link>
        <h1 className="text-[28px] font-semibold">리뷰 가져오기</h1>
        <p className="text-[15px] text-muted-foreground">모은 리뷰는 리뷰 리포트와 소구점 찾기에서 우리 제품과 경쟁 제품을 비교하는 데 쓰여요.</p>
      </div>
      <ImportSwitch type={type} tab={tab} product={product} />
      <ViewStateGate emptyAction="리뷰 CSV 올리기">
        {type === "own" ? <OwnSide product={product} /> : tab === "auto" ? <AutoSide product={product} /> : <CsvSide />}
      </ViewStateGate>
    </div>
  );
}

async function OwnSide({ product }: { product: string | null }) {
  const products = await getImportOwnProducts();
  const valid = product !== null && products.some((p) => p.id === product);
  // key: 주소의 제품이 바뀌면(리포트에서 다른 제품으로 들어오면) 처음 상태로 다시 그린다
  return <OwnReviewImport key={product ?? "none"} products={products} initialProductId={valid ? product : null} wrongProduct={product !== null && !valid} />;
}

async function AutoSide({ product }: { product: string | null }) {
  const projects = await getCollectionOwnProducts();
  return <PlatformCollect projects={projects} initialProjectId={product} />;
}

async function CsvSide() {
  const all = await getProducts();
  const products = all.map((p) => ({ id: p.id, name: p.name, brand: p.brand, kind: p.kind, platform: p.platform }));
  return <CsvImport products={products} />;
}
