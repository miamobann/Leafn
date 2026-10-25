"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { PromoEventView } from "@/lib/data/launch";
import { CalendarTodo, type PendingCopy } from "../_home/calendar-todo";
import { boardDeadlines, type HomeProject } from "../_home/project-board";

// FullCalendar는 브라우저에서만 그린다 (서버 렌더링 시 window가 없음)
const PromoCalendar = dynamic(() => import("./promo-calendar").then((m) => m.PromoCalendar), {
  ssr: false,
  loading: () => <Skeleton className="h-[640px] w-full" />,
});

/** 전체보기 캘린더. 일정을 고르지 않았을 때 오른쪽 패널에 홈 캘린더와 같은 다음 행사·할 일·문구 검토 대기를 보인다 (2026-10-25) */
export function CalendarClient({
  events,
  platformKeys,
  today,
  pending,
  projects,
}: {
  events: PromoEventView[];
  platformKeys: string[];
  today: string;
  pending: PendingCopy[];
  projects: HomeProject[];
}) {
  const board = boardDeadlines(projects);

  return (
    <PromoCalendar
      events={events}
      platformKeys={platformKeys}
      today={today}
      renderIdle={(ctx) => <CalendarTodo {...ctx} pending={pending} today={today} board={board} />}
    />
  );
}
