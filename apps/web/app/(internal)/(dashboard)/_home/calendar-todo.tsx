"use client";

import Link from "next/link";
import type { PromoEventView } from "@/lib/data/launch";
import { dDay } from "@/lib/format";

const TEXT = {
  next: "다음 행사",
  noNext: "예정된 행사가 없어요",
  milestones: "할 일 · 준비 마감",
  noMilestones: "다가오는 준비 마감이 없어요",
  pending: "할 일 · 문구 검토 대기",
  noPending: "검토를 기다리는 문구가 없어요",
  ownCampaign: "자사 캠페인",
  platformEvent: "플랫폼 행사",
  copyTag: "문구",
  copyDue: "행사 문구",
  openCheck: "검토 상세",
};

// 캘린더(calendar/promo-calendar.tsx)의 행사 막대와 같은 색
const KIND_COLOR = { platform_event: "var(--sentiment-positive)", own_campaign: "var(--risk-low)" };

// 패널이 너무 길어지지 않게 다가오는 준비 마감은 이만큼만 보여 준다
const UPCOMING_COUNT = 3;

export type PendingCopy = { id: string; text: string; eventId: string | null };

const monthDay = (date: string) => date.slice(5);

/** 홈 캘린더에서 아무 일정도 고르지 않았을 때 오른쪽 패널: 다음 행사, 다가오는 준비 마감, 검토 대기 문구 */
export function CalendarTodo({
  events,
  select,
  pending,
  today,
}: {
  events: PromoEventView[];
  select: (eventId: string) => void;
  pending: PendingCopy[];
  today: string;
}) {
  const next = events.filter((e) => e.startDate >= today).toSorted((a, b) => a.startDate.localeCompare(b.startDate))[0];
  const upcoming = events
    .flatMap((e) => e.milestones.filter((m) => !m.done && m.dueDate >= today).map((m) => ({ ...m, event: e })))
    .toSorted((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, UPCOMING_COUNT);
  const eventTitle = (id: string | null) => events.find((e) => e.id === id)?.title;

  return (
    <div className="space-y-5">
      <section aria-labelledby="calendar-todo-next">
        <h3 id="calendar-todo-next" className="mb-1.5 text-xs font-medium text-muted-foreground">
          {TEXT.next}
        </h3>
        {next ? (
          <button
            type="button"
            onClick={() => select(next.id)}
            className="flex w-full items-start gap-2.5 rounded-lg border bg-background p-3 text-left hover:bg-muted"
          >
            <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-sm" style={{ background: KIND_COLOR[next.kind] }} />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{next.title}</span>
              <span className="block text-xs text-muted-foreground">
                {next.platformName} · {next.kind === "own_campaign" ? TEXT.ownCampaign : TEXT.platformEvent} · {monthDay(next.startDate)} ~{" "}
                {monthDay(next.endDate)}
              </span>
            </span>
            <span className="font-semibold">{dDay(next.startDate)}</span>
          </button>
        ) : (
          <p className="text-muted-foreground">{TEXT.noNext}</p>
        )}
      </section>

      <section aria-labelledby="calendar-todo-milestones">
        <h3 id="calendar-todo-milestones" className="mb-1.5 text-xs font-medium text-muted-foreground">
          {TEXT.milestones}
        </h3>
        {upcoming.length === 0 ? (
          <p className="text-muted-foreground">{TEXT.noMilestones}</p>
        ) : (
          <ul className="space-y-0.5">
            {upcoming.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => select(m.event.id)}
                  className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-muted"
                >
                  <span className="min-w-11 shrink-0 rounded-full bg-muted px-1.5 text-center text-xs font-semibold">{dDay(m.dueDate)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block">{m.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {m.event.title} · {monthDay(m.dueDate)}
                    </span>
                  </span>
                  {m.label.includes(TEXT.copyTag) && (
                    <span className="shrink-0 rounded border px-1 text-xs text-muted-foreground">{TEXT.copyTag}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="calendar-todo-pending">
        <h3 id="calendar-todo-pending" className="mb-1.5 text-xs font-medium text-muted-foreground">
          {TEXT.pending} {pending.length}
        </h3>
        {pending.length === 0 ? (
          <p className="text-muted-foreground">{TEXT.noPending}</p>
        ) : (
          <ul className="space-y-0.5">
            {pending.map((c) => (
              <li key={c.id}>
                <Link href={`/ad-check/${c.id}`} className="flex items-center gap-2 rounded-md px-1.5 py-1.5 hover:bg-muted">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{c.text}</span>
                    {eventTitle(c.eventId) && (
                      <span className="block text-xs text-muted-foreground">
                        {eventTitle(c.eventId)} {TEXT.copyDue}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{TEXT.openCheck} →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
