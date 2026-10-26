"use client";

import Link from "next/link";
import type { PromoEventView } from "@/lib/data/launch";
import { dDay } from "@/lib/format";

const TEXT = {
  next: "다음 행사",
  noNext: "예정된 행사가 없어요",
  todo: "할 일",
  window: "마감 2주 안",
  count: "건",
  noTodo: "2주 안에 다가오는 마감이 없어요",
  pending: "문구 검토 대기",
  noPending: "검토를 기다리는 문구가 없어요",
  history: "검토 이력 →",
  copyTag: "문구",
  copyDue: "행사 문구",
};

// 할 일 목록에 넣을 마감의 범위와, 그중 눈에 띄게 할 범위 (오늘부터 며칠)
const TODO_WINDOW_DAYS = 14;
const SOON_DAYS = 7;

// D-day 칩: 홈 새 디자인 시안의 색 (2026-10-26). 지난 마감은 시안에 없어 현황판 반려와 같은 테라코타 테두리
const CHIP = {
  overdue: "border border-[#a65a3f] bg-card text-[#a65a3f]",
  soon: "bg-primary text-primary-foreground",
  later: "bg-accent text-primary",
};

export type PendingCopy = { id: string; text: string; eventId: string | null };

const ROW = "flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-muted";

const monthDay = (date: string) => date.slice(5);
const addDays = (date: string, days: number) => new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10);

/**
 * 캘린더에서 아무 일정도 고르지 않았을 때 보이는 할 일. 행사 준비 마감을 마감 순 한 목록으로 모은다.
 * 전체보기(/calendar)에는 다음 행사와 문구 검토 대기도 함께 보인다.
 * 홈은 그 둘을 위쪽 요약 칸과 문구 검토 대기 카드로 따로 보여서 끈다 (2026-10-26 홈 새 디자인)
 */
export function CalendarTodo({
  events,
  select,
  pending,
  today,
  showNext = true,
  showPending = true,
}: {
  events: PromoEventView[];
  select: (eventId: string) => void;
  pending: PendingCopy[];
  today: string;
  showNext?: boolean;
  showPending?: boolean;
}) {
  const until = addDays(today, TODO_WINDOW_DAYS);
  const soon = addDays(today, SOON_DAYS);

  const next = events.filter((e) => e.startDate >= today).toSorted((a, b) => a.startDate.localeCompare(b.startDate))[0];
  // 지난 마감도 끝내기 전까지 맨 위에 남긴다
  const todos = events
    .flatMap((e) =>
      e.milestones
        .filter((m) => !m.done && m.dueDate <= until)
        .map((m) => ({ key: m.id, label: m.label, source: e.title, dueDate: m.dueDate, copy: m.label.includes(TEXT.copyTag), eventId: e.id })),
    )
    .toSorted((a, b) => a.dueDate.localeCompare(b.dueDate));
  const eventTitle = (id: string | null) => events.find((e) => e.id === id)?.title;
  const chip = (dueDate: string) => (dueDate < today ? CHIP.overdue : dueDate < soon ? CHIP.soon : CHIP.later);

  return (
    <div className="space-y-4">
      {showNext && (
        <section aria-label={TEXT.next} className="border-b pb-3">
          {next ? (
            <button
              type="button"
              onClick={() => select(next.id)}
              className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-muted"
            >
              <span className="shrink-0 text-xs text-muted-foreground">{TEXT.next}</span>
              <span className="min-w-0 flex-1 truncate font-medium">{next.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{monthDay(next.startDate)}</span>
              <span className="shrink-0 font-semibold">{dDay(next.startDate, today)}</span>
            </button>
          ) : (
            <p className="text-muted-foreground">{TEXT.noNext}</p>
          )}
        </section>
      )}

      <section aria-labelledby="calendar-todo-list">
        <h3 id="calendar-todo-list" className="mb-2 flex items-baseline gap-2 text-base font-semibold">
          {TEXT.todo}
          <span className="text-xs font-normal text-muted-foreground">
            {TEXT.window} · {todos.length}
            {TEXT.count}
          </span>
        </h3>
        {todos.length === 0 ? (
          <p className="text-muted-foreground">{TEXT.noTodo}</p>
        ) : (
          <ul className="space-y-1">
            {todos.map((t) => (
              <li key={t.key}>
                <button type="button" onClick={() => select(t.eventId)} className={ROW}>
                  <span className={`min-w-12 shrink-0 rounded-full px-2 py-0.5 text-center text-xs font-medium tabular-nums ${chip(t.dueDate)}`}>
                    {dDay(t.dueDate, today)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block">{t.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {t.source} · {monthDay(t.dueDate)}
                    </span>
                  </span>
                  {t.copy && <span className="shrink-0 rounded-full border px-2 text-xs text-muted-foreground">{TEXT.copyTag}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showPending && (
        <section aria-labelledby="calendar-todo-pending" className="border-t pt-3">
          <div className="mb-1.5 flex items-baseline gap-2">
            <h3 id="calendar-todo-pending" className="font-semibold">
              {TEXT.pending}
            </h3>
            <span className="text-xs text-muted-foreground">
              {pending.length}
              {TEXT.count}
            </span>
            <Link href="/ad-check/history" className="ml-auto text-xs text-muted-foreground hover:text-foreground">
              {TEXT.history}
            </Link>
          </div>
          {pending.length === 0 ? (
            <p className="text-muted-foreground">{TEXT.noPending}</p>
          ) : (
            <ul className="space-y-0.5">
              {pending.map((c) => (
                <li key={c.id}>
                  <Link href={`/ad-check/${c.id}`} className="block rounded-md px-1.5 py-1 hover:bg-muted">
                    <span className="block truncate">{c.text}</span>
                    {eventTitle(c.eventId) && (
                      <span className="block text-xs text-muted-foreground">
                        {eventTitle(c.eventId)} {TEXT.copyDue}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
