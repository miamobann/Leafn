import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { ViewStateGate } from "@/components/common/view-state";
import { getAdChecks, getBoardProjects } from "@/lib/data";
import { getPlatformViews, getPromoEventViews, getToday } from "@/lib/data/launch";
import { CalendarClient } from "./calendar-client";

// T5 캘린더: 월 보기·목록 보기 + 플랫폼 필터 + 일정 패널.
// 사이드바 메뉴에서는 빠졌고(2026-10-24), 홈 캘린더의 「일정 관리 →」로 들어온다.
// 행사를 눌러 이름 · 날짜 · 확정 여부와 준비 마감을 고치고 지운다 (2026-10-26).
// 일정을 고르지 않았을 때 패널에는 홈과 같은 할 일·문구 검토 대기가 보인다 (2026-10-25)
export default async function CalendarPage() {
  const [events, platforms, today, pending, projects] = await Promise.all([
    getPromoEventViews(),
    getPlatformViews(),
    getToday(),
    getAdChecks({ status: "pending" }),
    getBoardProjects(),
  ]);

  return (
    <>
      <Link href="/" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft aria-hidden className="size-4" />
        홈으로
      </Link>
      <PageHeader title="프로모션 캘린더" description="행사 기간과 준비 마감을 추가 · 수정 · 삭제해요" featureId="I" />
      {/* 행사가 하나도 없어도 「행사 추가」를 쓸 수 있게 빈 화면으로 바꾸지 않는다 */}
      <ViewStateGate>
        <CalendarClient
          events={events}
          platformKeys={platforms.map((p) => p.key)}
          today={today}
          pending={pending.map((a) => ({ id: a.id, text: a.input_text, eventId: a.promo_event_id ?? null }))}
          projects={projects}
        />
      </ViewStateGate>
    </>
  );
}
