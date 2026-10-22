import { StatusBadge } from "@/components/common/badges";
import { PageHeader } from "@/components/layout/page-header";
import { CalendarTemplate } from "@/components/templates";
import { getAdChecks, getPromoEvents } from "@/lib/data";
import { dDay } from "@/lib/format";

export default async function CalendarPage() {
  const [events, checks] = await Promise.all([getPromoEvents(), getAdChecks()]);

  return (
    <>
      <PageHeader title="프로모션 캘린더" description="행사 기간과 준비 마감 (날짜는 샘플)" featureId="I" />
      <CalendarTemplate
        events={events.map((e) => {
          const check = checks.find((c) => c.promo_event_id === e.id);
          return {
            id: e.id,
            title: `${e.platform} · ${e.title}`,
            period: `${e.start_date} ~ ${e.end_date} · 준비 마감 ${e.prep_due_date}`,
            due: dDay(e.prep_due_date),
            meta: check ? (
              <span className="flex items-center gap-1 text-xs">
                행사용 문구 <StatusBadge status={check.review_status} />
              </span>
            ) : undefined,
          };
        })}
      />
      <p className="mt-2 text-xs text-muted-foreground">월 보기는 P6에서 FullCalendar로 연결</p>
    </>
  );
}
