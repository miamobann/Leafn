import { PageHeader } from "@/components/layout/page-header";
import { ViewStateGate } from "@/components/common/view-state";
import { getPlatformViews, getPromoEventViews } from "@/lib/data/launch";
import { CalendarClient } from "./calendar-client";

// T5 캘린더: 월 보기·목록 보기 + 플랫폼 필터 + 일정 패널
export default async function CalendarPage() {
  const [events, platforms] = await Promise.all([getPromoEventViews(), getPlatformViews()]);

  return (
    <>
      <PageHeader title="프로모션 캘린더" description="행사 기간과 준비 마감 (날짜는 샘플)" featureId="I" />
      <ViewStateGate state={events.length === 0 ? "empty" : "ready"}>
        <CalendarClient events={events} platformKeys={platforms.map((p) => p.key)} />
      </ViewStateGate>
    </>
  );
}
