"use client";

import { Maximize2 } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { PromoEventView } from "@/lib/data/launch";
import { CalendarTodo, type PendingCopy } from "./calendar-todo";
import { boardDeadlines, type HomeProject } from "./project-board";

const TEXT = {
  title: "프로모션 캘린더",
  fullView: "전체보기",
};

// 플랫폼 고르기·행사 추가·목록 보기는 전체보기(/calendar)에서 한다
const FULL_VIEW_HREF = "/calendar";

// FullCalendar는 브라우저에서만 그린다 (서버 렌더링 시 window가 없음). 자리 높이는 홈용 캘린더(520px)와 위 줄을 합친 값
const PromoCalendar = dynamic(() => import("../calendar/promo-calendar").then((m) => m.PromoCalendar), {
  ssr: false,
  loading: () => <Skeleton className="h-[560px] w-full" />,
});

export function HomeCalendar({
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
  /** 현황판의 단계 마감도 할 일 목록에 함께 넣는다 */
  projects: HomeProject[];
}) {
  const board = boardDeadlines(projects);

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>{TEXT.title}</CardTitle>
        <CardAction>
          <Link href={FULL_VIEW_HREF} className={buttonVariants({ variant: "outline", size: "sm" })}>
            {TEXT.fullView}
            <Maximize2 aria-hidden className="size-3.5" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {/* 다음 행사와 할 일은 따로 상자를 두지 않고, 아무 일정도 고르지 않았을 때 캘린더 오른쪽 패널에 보인다 */}
        <PromoCalendar
          events={events}
          platformKeys={platformKeys}
          today={today}
          variant="home"
          renderIdle={(ctx) => <CalendarTodo {...ctx} pending={pending} today={today} board={board} />}
        />
      </CardContent>
    </Card>
  );
}
