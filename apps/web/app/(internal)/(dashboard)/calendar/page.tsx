import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { ViewStateGate } from "@/components/common/view-state";
import { getPlatformViews, getPromoEventViews, getToday } from "@/lib/data/launch";
import { CalendarClient } from "./calendar-client";

// T5 캘린더: 월 보기·목록 보기 + 플랫폼 필터 + 일정 패널.
// 사이드바 메뉴에서는 빠졌고(2026-10-24), 홈 캘린더의 「전체보기」로 들어온다
export default async function CalendarPage() {
  const [events, platforms, today] = await Promise.all([getPromoEventViews(), getPlatformViews(), getToday()]);

  return (
    <>
      <Link href="/" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft aria-hidden className="size-4" />
        홈으로
      </Link>
      <PageHeader title="프로모션 캘린더" description="행사 기간과 준비 마감 (날짜는 샘플)" featureId="I" />
      <ViewStateGate state={events.length === 0 ? "empty" : "ready"}>
        <CalendarClient events={events} platformKeys={platforms.map((p) => p.key)} today={today} />
      </ViewStateGate>
    </>
  );
}
