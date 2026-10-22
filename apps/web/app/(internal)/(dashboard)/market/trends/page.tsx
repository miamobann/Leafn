import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { BarList, ReportTemplate } from "@/components/templates";
import { getTrendSnapshots } from "@/lib/data";
import { formatDate, formatJpy } from "@/lib/format";

const CATEGORY = "化粧水";

export default async function MarketTrendsPage() {
  const snapshots = await getTrendSnapshots({ category: CATEGORY });
  const latest = snapshots.at(-1);

  return (
    <>
      <PageHeader title="시장 트렌드" description="라쿠텐 랭킹 기반 카테고리별 추이 (샘플)" featureId="B" />
      <ReportTemplate
        filters={<Badge variant="outline">카테고리: {CATEGORY}</Badge>}
        cards={[
          {
            title: "상위 3위 중 K-뷰티 수 (주별)",
            content: (
              <BarList
                items={snapshots.map((s) => ({
                  label: formatDate(s.captured_at),
                  value: s.data.ranking.filter((r) => r.is_kbeauty).length,
                }))}
              />
            ),
          },
          {
            title: "리뷰 수 추이 (1위 상품)",
            content: (
              <BarList
                items={snapshots.map((s) => ({ label: formatDate(s.captured_at), value: s.data.ranking[0]?.review_count ?? 0 }))}
              />
            ),
          },
          {
            title: "이번 주 랭킹",
            wide: true,
            content: (
              <ol className="space-y-1 text-sm">
                {latest?.data.ranking.map((r) => (
                  <li key={r.rank}>
                    {r.rank}. {r.brand} {r.name} · {formatJpy(r.price_jpy)} {r.is_kbeauty && <Badge variant="secondary">K-뷰티</Badge>}
                  </li>
                ))}
              </ol>
            ),
          },
        ]}
      />
    </>
  );
}
