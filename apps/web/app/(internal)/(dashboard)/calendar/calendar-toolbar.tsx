"use client";

// 프로모션 캘린더 머리줄 부품 (2026-10-26 홈 새 디자인 목업). 홈(_home/home-calendar.tsx)과 /calendar(promo-calendar.tsx)가 같이 쓴다.
// FullCalendar 기본 툴바 대신 쓰고, 값과 동작은 PromoCalendar가 CalendarControls로 넘긴다
import { ChevronLeft, ChevronRight } from "lucide-react";

export type CalendarView = "dayGridMonth" | "dayGridWeek" | "listMonth";

/** 머리줄이 보기 전환 · 이전 · 다음 · 오늘을 부를 때 쓰는 값 */
export type CalendarControls = {
  view: CalendarView;
  /** 보이는 기간의 첫날과, 마지막 날의 다음 날. 캘린더가 뜨기 전에는 null */
  start: Date | null;
  end: Date | null;
  prev: () => void;
  next: () => void;
  today: () => void;
  setView: (view: CalendarView) => void;
};

const TEXT = {
  views: "보기",
  prev: { dayGridMonth: "이전 달", dayGridWeek: "이전 주", listMonth: "이전 달" },
  next: { dayGridMonth: "다음 달", dayGridWeek: "다음 주", listMonth: "다음 달" },
  today: "오늘",
  legend: "일정 색",
};

// 범례 색은 globals.css .fc-leaf의 칩 색과 같다 (홈 새 디자인 목업)
const LEGEND = [
  { label: "플랫폼 행사", swatch: "bg-[#d5e2e8]" },
  { label: "자사 캠페인", swatch: "bg-[#cfe3cb]" },
  { label: "▲ 준비 마감", swatch: "bg-[#f2e4d6]" },
];

const CIRCLE = "inline-flex size-9 items-center justify-center rounded-full border border-[#d3e0d1] bg-card hover:bg-muted";

/** 월 보기 "2026. 10", 주 보기 "10. 25 – 10. 31" */
function rangeLabel({ view, start, end }: CalendarControls) {
  if (!start || !end) return "";
  if (view !== "dayGridWeek") return `${start.getFullYear()}. ${start.getMonth() + 1}`;
  const last = new Date(end.getTime() - 86_400_000);
  return `${start.getMonth() + 1}. ${start.getDate()} – ${last.getMonth() + 1}. ${last.getDate()}`;
}

/** 월·주(또는 월·일정목록) 알약 */
export function ViewToggle({ controls, views }: { controls: CalendarControls; views: { key: CalendarView; label: string }[] }) {
  return (
    <span role="group" aria-label={TEXT.views} className="inline-flex gap-1 rounded-full bg-[#fafbfa] p-1">
      {views.map((v) => (
        <button
          key={v.key}
          type="button"
          aria-pressed={controls.view === v.key}
          onClick={() => controls.setView(v.key)}
          className={`rounded-full px-3.5 py-1.5 text-xs whitespace-nowrap ${
            controls.view === v.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {v.label}
        </button>
      ))}
    </span>
  );
}

/** 원형 이전 · 기간 · 원형 다음 (today를 주면 끝에 「오늘」) */
export function RangeNav({ controls, today = false }: { controls: CalendarControls; today?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={controls.prev} aria-label={TEXT.prev[controls.view]} className={CIRCLE}>
        <ChevronLeft aria-hidden className="size-3.5" strokeWidth={2} />
      </button>
      <span aria-live="polite" className="min-w-[4.5rem] px-1.5 text-center text-[15px] tabular-nums">
        {rangeLabel(controls)}
      </span>
      <button type="button" onClick={controls.next} aria-label={TEXT.next[controls.view]} className={CIRCLE}>
        <ChevronRight aria-hidden className="size-3.5" strokeWidth={2} />
      </button>
      {today && (
        <button type="button" onClick={controls.today} className="h-9 rounded-full border border-[#d3e0d1] bg-card px-3.5 text-xs hover:bg-muted">
          {TEXT.today}
        </button>
      )}
    </span>
  );
}

export function CalendarLegend() {
  return (
    <ul aria-label={TEXT.legend} className="flex flex-wrap gap-4 text-xs text-muted-foreground">
      {LEGEND.map((l) => (
        <li key={l.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden className={`size-2.5 rounded-[3px] ${l.swatch}`} />
          {l.label}
        </li>
      ))}
    </ul>
  );
}
