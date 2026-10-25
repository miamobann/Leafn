"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { PromoEventView } from "@/lib/data/launch";
import { CalendarTodo, type PendingCopy } from "./calendar-todo";
import { boardDeadlines, type HomeProject, useBoardPicks } from "./project-board";

const TEXT = {
  title: "프로모션 캘린더",
  // 추가 · 수정 · 삭제를 하는 곳이 보이게 이름을 붙인다 (calendar-edit 제안, 2026-10-26)
  fullView: "일정 관리 →",
};

// 플랫폼 고르기·행사 추가·수정·삭제·목록 보기는 전체보기(/calendar)에서 한다. 홈에서는 준비 마감 체크만
const FULL_VIEW_HREF = "/calendar";

// 할 일 패널의 왼쪽 선을 위 탭 요약 카드 열의 왼쪽 끝에 맞춘다 (page.tsx: 65:35 두 열, 열 간격 1rem · 카드 안쪽 여백 1rem).
// 카드 폭을 W, 캘린더 칸 폭을 C(= W - 2rem)라 하면 패널 폭 = 0.35W - 1rem - 0.35rem = C의 35% - 0.65rem
const PANEL_WIDTH = "calc(35% - 0.65rem)";

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
  /** 현황판의 단계 마감도 할 일 목록에 함께 넣는다. 홈 현황판에 보이는 프로젝트 것만 */
  projects: HomeProject[];
}) {
  const picks = useBoardPicks();
  const board = boardDeadlines(picks ? projects.filter((p) => picks.includes(p.id)) : projects);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{TEXT.title}</CardTitle>
        <CardAction>
          <Link href={FULL_VIEW_HREF} className={buttonVariants({ variant: "outline", size: "sm" })}>
            {TEXT.fullView}
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
          panelWidth={PANEL_WIDTH}
          renderIdle={(ctx) => <CalendarTodo {...ctx} pending={pending} today={today} board={board} />}
        />
      </CardContent>
    </Card>
  );
}
