"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import type { PromoEventView } from "@/lib/data/launch";
import { CalendarTodo } from "./calendar-todo";
import { HOME_TODO_ID } from "./ids";

const TEXT = {
  title: "프로모션 캘린더",
  // 추가 · 수정 · 삭제를 하는 곳이 보이게 이름을 붙인다 (calendar-edit 제안, 2026-10-26)
  fullView: "일정 관리 →",
};

// 플랫폼 고르기·행사 추가·수정·삭제·목록 보기는 전체보기(/calendar)에서 한다. 홈에서는 준비 마감 체크만
const FULL_VIEW_HREF = "/calendar";

// FullCalendar는 브라우저에서만 그린다 (서버 렌더링 시 window가 없음). 자리 높이는 홈용 캘린더(520px)와 위 줄을 합친 값
const PromoCalendar = dynamic(() => import("../calendar/promo-calendar").then((m) => m.PromoCalendar), {
  ssr: false,
  loading: () => <Skeleton className="h-[640px] w-full rounded-3xl" />,
});

/** 홈 아래 줄: 캘린더 카드와 할 일 카드 (2026-10-26 홈 새 디자인). 다음 행사·문구 검토 대기는 위쪽 카드가 맡는다 */
export function HomeCalendar({ events, platformKeys, today }: { events: PromoEventView[]; platformKeys: string[]; today: string }) {
  return (
    <PromoCalendar
      events={events}
      platformKeys={platformKeys}
      today={today}
      variant="home"
      panelId={HOME_TODO_ID}
      header={
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium">{TEXT.title}</h2>
          <Link href={FULL_VIEW_HREF} className="text-sm font-medium whitespace-nowrap hover:underline">
            {TEXT.fullView}
          </Link>
        </div>
      }
      renderIdle={(ctx) => <CalendarTodo {...ctx} pending={[]} today={today} showNext={false} showPending={false} />}
    />
  );
}
