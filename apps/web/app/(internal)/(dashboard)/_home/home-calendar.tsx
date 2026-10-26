"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import type { PromoEventView } from "@/lib/data/launch";
import type { CalendarControls } from "../calendar/promo-calendar";
import { CalendarTodo } from "./calendar-todo";
import type { HomeNextEvent } from "./home-header";
import { HOME_TODO_ID } from "./ids";

const TEXT = {
  title: "프로모션 캘린더",
  // 추가 · 수정 · 삭제를 하는 곳이 보이게 이름을 붙인다 (calendar-edit 제안, 2026-10-26)
  fullView: "일정 관리 →",
  views: "보기",
  month: "월",
  week: "주",
  prev: { dayGridMonth: "이전 달", dayGridWeek: "이전 주" },
  next: { dayGridMonth: "다음 달", dayGridWeek: "다음 주" },
  nextEvent: "다음 행사",
  legend: "일정 색",
};

// 플랫폼 고르기·행사 추가·수정·삭제·목록 보기는 전체보기(/calendar)에서 한다. 홈에서는 준비 마감 체크만
const FULL_VIEW_HREF = "/calendar";

// 범례 색은 globals.css .fc-home의 칩 색과 같다 (홈 새 디자인 목업)
const LEGEND = [
  { label: "플랫폼 행사", swatch: "bg-[#d5e2e8]" },
  { label: "자사 캠페인", swatch: "bg-[#cfe3cb]" },
  { label: "▲ 준비 마감", swatch: "bg-[#f2e4d6]" },
];

const VIEWS: { key: CalendarControls["view"]; label: string }[] = [
  { key: "dayGridMonth", label: TEXT.month },
  { key: "dayGridWeek", label: TEXT.week },
];

const CIRCLE = "inline-flex size-9 items-center justify-center rounded-full border border-[#d3e0d1] bg-card hover:bg-muted";

/** 월 보기 "2026. 10", 주 보기 "10. 25 – 10. 31" */
function rangeLabel({ view, start, end }: CalendarControls) {
  if (!start || !end) return "";
  if (view === "dayGridMonth") return `${start.getFullYear()}. ${start.getMonth() + 1}`;
  const last = new Date(end.getTime() - 86_400_000);
  return `${start.getMonth() + 1}. ${start.getDate()} – ${last.getMonth() + 1}. ${last.getDate()}`;
}

// FullCalendar는 브라우저에서만 그린다 (서버 렌더링 시 window가 없음). 자리 높이는 머리줄과 5주 칸을 합친 값
const PromoCalendar = dynamic(() => import("../calendar/promo-calendar").then((m) => m.PromoCalendar), {
  ssr: false,
  loading: () => <Skeleton className="h-[680px] w-full rounded-3xl" />,
});

/** 홈 아래 줄: 캘린더 카드와 할 일 카드 (2026-10-26 홈 새 디자인). 문구 검토 대기는 위쪽 카드가 맡는다 */
export function HomeCalendar({
  events,
  platformKeys,
  today,
  next,
}: {
  events: PromoEventView[];
  platformKeys: string[];
  today: string;
  /** 다음 행사 (요약 칸과 같은 값) */
  next: HomeNextEvent;
}) {
  return (
    <PromoCalendar
      events={events}
      platformKeys={platformKeys}
      today={today}
      variant="home"
      panelId={HOME_TODO_ID}
      toolbar={(c) => (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-medium">{TEXT.title}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <span role="group" aria-label={TEXT.views} className="inline-flex gap-1 rounded-full bg-[#fafbfa] p-1">
                {VIEWS.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    aria-pressed={c.view === v.key}
                    onClick={() => c.setView(v.key)}
                    className={`rounded-full px-3.5 py-1.5 text-xs ${
                      c.view === v.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </span>
              <button type="button" onClick={c.prev} aria-label={TEXT.prev[c.view]} className={CIRCLE}>
                <ChevronLeft aria-hidden className="size-3.5" strokeWidth={2} />
              </button>
              <span aria-live="polite" className="min-w-[4.5rem] px-1.5 text-center text-[15px] tabular-nums">
                {rangeLabel(c)}
              </span>
              <button type="button" onClick={c.next} aria-label={TEXT.next[c.view]} className={CIRCLE}>
                <ChevronRight aria-hidden className="size-3.5" strokeWidth={2} />
              </button>
              <Link href={FULL_VIEW_HREF} className="pl-2 text-[13px] font-medium whitespace-nowrap text-[#3a4d40] hover:underline">
                {TEXT.fullView}
              </Link>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs">
            <ul aria-label={TEXT.legend} className="flex flex-wrap gap-4 text-muted-foreground">
              {LEGEND.map((l) => (
                <li key={l.label} className="inline-flex items-center gap-1.5">
                  <span aria-hidden className={`size-2.5 rounded-[3px] ${l.swatch}`} />
                  {l.label}
                </li>
              ))}
            </ul>
            {next && (
              <Link href={`/calendar?event=${next.id}`} className="hover:underline">
                {TEXT.nextEvent} <b className="font-medium">{next.title}</b>{" "}
                <span className="text-muted-foreground tabular-nums">
                  {next.date} · {next.dDay}
                </span>
              </Link>
            )}
          </div>
        </div>
      )}
      renderIdle={(ctx) => <CalendarTodo {...ctx} pending={[]} today={today} showNext={false} showPending={false} />}
    />
  );
}
