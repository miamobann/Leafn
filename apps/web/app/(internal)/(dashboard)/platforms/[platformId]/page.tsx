import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { DetailTemplate } from "@/components/templates";
import { getPlatformView, getPlatformViews, getPromoEventViews, nextMilestone } from "@/lib/data/launch";
import { dDay } from "@/lib/format";
import { CHANNEL } from "../labels";
import { NoteEditor } from "./note-editor";

export async function generateStaticParams() {
  return (await getPlatformViews()).map((p) => ({ platformId: p.id }));
}

export default async function PlatformDetailPage({ params }: { params: Promise<{ platformId: string }> }) {
  const platform = await getPlatformView((await params).platformId);
  if (!platform) notFound();
  const events = await getPromoEventViews({ platformKey: platform.key });

  return (
    <>
      <PageHeader title={platform.name} description="플랫폼 상세" featureId="H" />
      <DetailTemplate
        badges={platform.channel && <Badge variant="secondary">{CHANNEL[platform.channel]}</Badge>}
        attributes={[
          { label: "강점", value: platform.strengths },
          { label: "주 고객층", value: platform.audience },
          { label: "수수료", value: platform.feesNote ?? "공식 자료 확인 전" },
          { label: "마지막 수정", value: platform.updatedBy },
        ]}
        sections={[
          { title: "우리 상태와 메모", content: <NoteEditor id={platform.id} status={platform.status} memo={platform.memo} /> },
          {
            title: "다가오는 행사",
            content:
              events.length === 0 ? (
                <p className="text-sm text-muted-foreground">예정된 행사가 없어요</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {events.map((e) => {
                    const m = nextMilestone(e);
                    return (
                      <li key={e.id}>
                        <Link href={`/calendar?event=${e.id}`} className="underline-offset-4 hover:underline">
                          {e.title}
                        </Link>{" "}
                        · {e.startDate} ({dDay(e.startDate)}){m && ` · ${m.label} 마감 ${dDay(m.dueDate)}`}
                      </li>
                    );
                  })}
                </ul>
              ),
          },
        ]}
      />
    </>
  );
}
