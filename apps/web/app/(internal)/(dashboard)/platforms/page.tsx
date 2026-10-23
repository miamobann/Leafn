import { PageHeader } from "@/components/layout/page-header";
import { ViewStateGate } from "@/components/common/view-state";
import { getPlatformViews, getPromoEventViews, nextMilestone } from "@/lib/data/launch";
import { dDay } from "@/lib/format";
import { PlatformBoard } from "./platform-board";

// T2 표 템플릿: 카드 보기 ↔ 표 보기
export default async function PlatformsPage() {
  const [platforms, events] = await Promise.all([getPlatformViews(), getPromoEventViews()]);
  const nextEvent = Object.fromEntries(
    platforms.map((p) => {
      const e = events.find((ev) => ev.platformKey === p.key);
      const m = e && nextMilestone(e);
      return [p.id, e ? `${e.title} · ${e.startDate}${m ? ` (마감 ${dDay(m.dueDate)})` : ""}` : null];
    }),
  );

  return (
    <>
      <PageHeader title="플랫폼별 강점" description="진출·홍보 플랫폼 비교 (샘플 문구)" featureId="H" />
      <ViewStateGate state={platforms.length === 0 ? "empty" : "ready"}>
        <PlatformBoard platforms={platforms} nextEvent={nextEvent} />
      </ViewStateGate>
    </>
  );
}
