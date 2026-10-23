import Link from "next/link";
import { AiDisclaimer } from "@/components/common/ai";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { getAdCheck, getWorkspace } from "@/lib/data";
import { ReviewWorkspace } from "./_components/review-workspace";
import { PRODUCTS } from "./_lib/products";

type AdCheckPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdCheckPage({ searchParams }: AdCheckPageProps) {
  // 검토 내역의 「이 내용으로 새 검토」: ?from=<검토 ID> 의 원문·제품·사용처를 입력칸에 채운다
  const from = (await searchParams).from;
  const [workspace, source] = await Promise.all([getWorkspace(), typeof from === "string" ? getAdCheck(from) : null]);
  const initial = source ? { productId: source.product_id, usage: source.usage, text: source.input_text } : undefined;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <PageHeader title="새 광고 검토" description="약기법 위험 표현, 사유·근거, 대체 표현, 현지화를 줄별로 확인합니다" featureId="A" />
        <Link href="/ad-check/history" className={`${buttonVariants({ variant: "outline" })} border-foreground/40!`}>
          검토 내역
        </Link>
      </div>
      <AiDisclaimer />
      <p className="mt-2 text-xs text-muted-foreground">
        AI 판정(정밀 등급) · 아직 저장되지 않음 · 「내부 검토 완료」는 법적 승인이 아닙니다
      </p>
      <div className="mt-4">
        <ReviewWorkspace key={source?.id ?? "new"} products={PRODUCTS} workspaceId={workspace.id} initial={initial} />
      </div>
    </>
  );
}
