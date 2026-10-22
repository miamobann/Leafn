import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ViewStateGate } from "@/components/common/view-state";
import { PageHeader } from "@/components/layout/page-header";
import { getPlatforms } from "@/lib/data";

const CHANNEL = { ec: "판매 EC", review_sns: "리뷰·SNS 홍보", offline: "오프라인" } as const;
const STATUS = { reviewing: "검토", preparing: "준비", live: "입점" } as const;

// T2 표 템플릿의 카드 보기
export default async function PlatformsPage() {
  const platforms = await getPlatforms();

  return (
    <>
      <PageHeader title="플랫폼별 강점" description="진출·홍보 플랫폼 비교 (샘플 문구)" featureId="H" />
      <ViewStateGate state={platforms.length === 0 ? "empty" : "ready"}>
        <div className="grid grid-cols-2 gap-4">
          {platforms.map((p) => (
            <Link key={p.id} href={`/platforms/${p.id}`}>
              <Card className="h-full hover:bg-muted/50">
                <CardHeader>
                  <CardTitle>{p.platform}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    {p.channel_type && <Badge variant="secondary">{CHANNEL[p.channel_type]}</Badge>}
                    {p.status && <Badge variant="outline">{STATUS[p.status]}</Badge>}
                  </div>
                  <p>{p.strengths}</p>
                  <p className="text-muted-foreground">{p.audience}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </ViewStateGate>
    </>
  );
}
