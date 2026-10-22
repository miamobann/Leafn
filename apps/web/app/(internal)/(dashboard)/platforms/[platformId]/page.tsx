import { notFound } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/page-header";
import { DetailTemplate } from "@/components/templates";
import { getMemberName, getPlatform, getPlatforms, getPromoEvents } from "@/lib/data";
import { dDay } from "@/lib/format";

export async function generateStaticParams() {
  return (await getPlatforms()).map((p) => ({ platformId: p.id }));
}

export default async function PlatformDetailPage({ params }: { params: Promise<{ platformId: string }> }) {
  const platform = await getPlatform((await params).platformId);
  if (!platform) notFound();
  const [events, updatedBy] = await Promise.all([getPromoEvents({ platform: platform.platform }), getMemberName(platform.updated_by)]);

  return (
    <>
      <PageHeader title={platform.platform} description="플랫폼 상세" featureId="H" />
      <DetailTemplate
        attributes={[
          { label: "강점", value: platform.strengths },
          { label: "주 고객층", value: platform.audience },
          { label: "수수료", value: platform.fees_note ?? "공식 자료 확인 전" },
          { label: "마지막 수정", value: updatedBy },
        ]}
        sections={[
          { title: "메모", content: <Textarea placeholder="팀 메모 (P6에서 연결)" disabled /> },
          {
            title: "다가오는 행사",
            content:
              events.length === 0 ? (
                <p className="text-sm text-muted-foreground">예정된 행사가 없어요</p>
              ) : (
                <ul className="text-sm">
                  {events.map((e) => (
                    <li key={e.id}>
                      {e.title} · {e.start_date} ({dDay(e.start_date)})
                    </li>
                  ))}
                </ul>
              ),
          },
        ]}
      />
    </>
  );
}
