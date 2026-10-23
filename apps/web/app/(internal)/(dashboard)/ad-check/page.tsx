import Link from "next/link";
import { AiDisclaimer } from "@/components/common/ai";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { WORKSPACE_ID } from "@/lib/mock/helpers";
import { ActionBadge, ReviewStateBadge, USAGE_LABEL } from "./_components/ad-badges";
import { ReviewWorkspace } from "./_components/review-workspace";
import { getLabAdChecks, getLabProducts, getSampleBook } from "./_lib/data";

const RECENT = 3;

// AD_CHECK_LAB_AI 를 빌드 때가 아니라 요청 때마다 서버에서 읽는다
export const dynamic = "force-dynamic";

export default async function AdCheckPage() {
  const [products, book, recent] = await Promise.all([getLabProducts(), getSampleBook(), getLabAdChecks({ limit: RECENT })]);
  // 키는 서버에서만 읽는다. 화면에는 켜짐 여부(true/false)만 넘긴다
  const aiEnabled = process.env.AD_CHECK_LAB_AI === "1";
  const productName = (id: string | undefined) => products.find((p) => p.id === id)?.name_ko ?? "—";

  return (
    <>
      <PageHeader title="새 광고 검토" description="약기법 위험 표현, 사유·근거, 대체 표현, 현지화를 줄별로 확인합니다" featureId="A" />
      <AiDisclaimer />
      <p className="mt-2 text-xs text-muted-foreground">
        {aiEnabled ? "샘플 판정 또는 AI 판정(연습장, API 호출)을 고를 수 있습니다" : "샘플 판정 · AI 미연결"} · 저장되지 않음 · 「내부 검토 완료」는 법적 승인이 아닙니다
      </p>
      <div className="mt-4">
        <ReviewWorkspace products={products} book={book} workspaceId={WORKSPACE_ID} aiEnabled={aiEnabled} />
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
