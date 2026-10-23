import Link from "next/link";
import { AiDisclaimer } from "@/components/common/ai";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { WORKSPACE_ID } from "@/lib/mock/helpers";
import { ActionBadge, ReviewStateBadge, USAGE_LABEL } from "./_components/ad-badges";
import { ReviewWorkspace } from "./_components/review-workspace";
import { getAdChecks, getProducts } from "@/lib/data";
import { PRODUCTS } from "./_lib/products";

const RECENT = 3;

export default async function AdCheckPage() {
  const [checks, shared] = await Promise.all([getAdChecks(), getProducts()]);
  const recent = [...checks].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, RECENT);
  const names = new Map([...shared.map((p) => [p.id, p.name] as const), ...PRODUCTS.map((p) => [p.id, p.name_ko] as const)]);
  const productName = (id: string | undefined) => names.get(id ?? "") ?? "—";

  return (
    <>
      <PageHeader title="새 광고 검토" description="약기법 위험 표현, 사유·근거, 대체 표현, 현지화를 줄별로 확인합니다" featureId="A" />
      <AiDisclaimer />
      <p className="mt-2 text-xs text-muted-foreground">
        AI 판정(정밀 등급) · 아직 저장되지 않음 · 「내부 검토 완료」는 법적 승인이 아닙니다
      </p>
      <div className="mt-4">
        <ReviewWorkspace products={PRODUCTS} workspaceId={WORKSPACE_ID} />
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            최근 검토 이력
            <Link href="/ad-check/history" className="text-sm font-normal text-muted-foreground underline underline-offset-4">
              전체 이력 보기
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y text-sm">
            {recent.map((c) => (
              <li key={c.id}>
                <Link href={`/ad-check/${c.id}`} className="flex flex-wrap items-center gap-3 py-2 hover:bg-muted">
                  <span className="w-28 text-muted-foreground">{formatDate(c.created_at)}</span>
                  <span className="min-w-48 flex-1">
                    {productName(c.product_id)} · {c.usage ? USAGE_LABEL[c.usage] : "—"}
                  </span>
                  {c.overall_action && <ActionBadge action={c.overall_action} />}
                  <ReviewStateBadge status={c.review_status} expertRequested={c.is_expert_review_requested} />
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
