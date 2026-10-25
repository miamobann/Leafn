"use client";

import Link from "next/link";
import type { PromoEventView } from "@/lib/data/launch";
import { dDay } from "@/lib/format";
import { type BoardDeadline, stageHref, useOwnerFilter, useStageSelect } from "./project-board";

const TEXT = {
  next: "다음 행사",
  noNext: "예정된 행사가 없어요",
  todo: "할 일",
  window: "마감 2주 안",
  count: "건",
  noTodo: "2주 안에 다가오는 마감이 없어요",
  hidden: (n: number) => `현황판에서 고른 담당자 것만 보여요. 다른 사람 단계 마감 ${n}건은 숨겼고, 담당이 없는 행사 마감은 그대로 보여요.`,
  pending: "문구 검토 대기",
  noPending: "검토를 기다리는 문구가 없어요",
  history: "검토 이력 →",
  copyTag: "문구",
  copyDue: "행사 문구",
  tag: { board: "현황판", event: "행사", blocked: "막힘" },
};

// 할 일 목록에 넣을 마감의 범위와, 그중 눈에 띄게 할 범위 (오늘부터 며칠)
const TODO_WINDOW_DAYS = 14;
const SOON_DAYS = 7;

const TAG_STYLE = {
  board: "border text-muted-foreground",
  event: "border text-muted-foreground",
  blocked: "bg-risk-medium/20 text-foreground",
};

export type PendingCopy = { id: string; text: string; eventId: string | null };

type TodoItem = {
  key: string;
  label: string;
  source: string;
  dueDate: string;
  tag: keyof typeof TAG_STYLE;
  copy: boolean;
  /** 누르면: 이 화면에서 바로 연다(함수), 또는 다른 화면으로 간다(주소) */
  open: (() => void) | string;
};

const ROW = "flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-muted";

const monthDay = (date: string) => date.slice(5);
const addDays = (date: string, days: number) => new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10);

/**
 * 홈 캘린더와 전체보기(/calendar)에서 아무 일정도 고르지 않았을 때 오른쪽 패널.
 * 행사 준비 마감을 마감 순 한 목록으로 모으고, 그 아래 검토 대기 문구를 둔다.
 * board(8단계 현황판의 단계 마감)는 홈 현황판이 제품 × 탭 진행 표로 바뀌어(2026-10-26) 지금은 넘기는 곳이 없다
 */
export function CalendarTodo({
  events,
  select,
  pending,
  today,
  board = [],
}: {
  events: PromoEventView[];
  select: (eventId: string) => void;
  pending: PendingCopy[];
  today: string;
  board?: BoardDeadline[];
}) {
  const selectStage = useStageSelect();
  const owner = useOwnerFilter();
  const until = addDays(today, TODO_WINDOW_DAYS);
  const soon = addDays(today, SOON_DAYS);
  const inWindow = (date: string) => date >= today && date <= until;

  const next = events.filter((e) => e.startDate >= today).toSorted((a, b) => a.startDate.localeCompare(b.startDate))[0];
  const boardDue = board.filter((d) => inWindow(d.dueDate));
  const mine = boardDue.filter((d) => !owner || d.ownerId === owner);
  const todos: TodoItem[] = [
    ...mine.map((d) => ({
      key: `${d.projectId}-${d.stage}`,
      label: d.label,
      source: `${d.projectName} · ${d.stageLabel}`,
      dueDate: d.dueDate,
      tag: d.blocked ? ("blocked" as const) : ("board" as const),
      copy: false,
      open: selectStage ? () => selectStage(d.projectId, d.stage) : stageHref(d.projectId, d.stage),
    })),
    ...events.flatMap((e) =>
      e.milestones
        .filter((m) => !m.done && inWindow(m.dueDate))
        .map((m) => ({
          key: m.id,
          label: m.label,
          source: e.title,
          dueDate: m.dueDate,
          tag: "event" as const,
          copy: m.label.includes(TEXT.copyTag),
          open: () => select(e.id),
        })),
    ),
  ].toSorted((a, b) => a.dueDate.localeCompare(b.dueDate));
  const eventTitle = (id: string | null) => events.find((e) => e.id === id)?.title;

  return (
    <div className="space-y-4">
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

      <section aria-labelledby="calendar-todo-list">
        <h3 id="calendar-todo-list" className="mb-1.5 flex items-baseline gap-2 font-semibold">
          {TEXT.todo}
          <span className="text-xs font-normal text-muted-foreground">
            {TEXT.window} · {todos.length}
            {TEXT.count}
          </span>
        </h3>
        {todos.length === 0 ? (
          <p className="text-muted-foreground">{TEXT.noTodo}</p>
        ) : (
          <ul className="space-y-0.5">
            {todos.map((t) => {
              const body = (
                <>
                  <span
                    className={`min-w-11 shrink-0 rounded-full px-1.5 text-center text-xs font-semibold ${
                      t.dueDate < soon ? "bg-risk-high/10 text-risk-high" : "bg-muted"
                    }`}
                  >
                    {dDay(t.dueDate, today)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block">{t.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {t.source} · {monthDay(t.dueDate)}
                    </span>
                  </span>
                  {t.copy && <span className="shrink-0 rounded border px-1 text-xs text-muted-foreground">{TEXT.copyTag}</span>}
                  <span className={`shrink-0 rounded px-1 text-xs ${TAG_STYLE[t.tag]}`}>{TEXT.tag[t.tag]}</span>
                </>
              );
              return (
                <li key={t.key}>
                  {typeof t.open === "string" ? (
                    <Link href={t.open} className={ROW}>
                      {body}
                    </Link>
                  ) : (
                    <button type="button" onClick={t.open} className={ROW}>
                      {body}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {owner && <p className="mt-1.5 px-1.5 text-xs text-muted-foreground">{TEXT.hidden(boardDue.length - mine.length)}</p>}
      </section>

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
    </div>
  );
}
