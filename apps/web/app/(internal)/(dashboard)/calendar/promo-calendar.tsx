"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useRef, useState, useTransition } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import koLocale from "@fullcalendar/core/locales/ko";
import type { EventInput } from "@fullcalendar/core";
import { StatusBadge } from "@/components/common/badges";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MilestoneView, PromoEventView } from "@/lib/data/launch";
import { setMilestoneDone } from "@/lib/data/launch-actions";
import { dDay } from "@/lib/format";
import { PLATFORMS, platformLabel } from "@/lib/platforms";
import { EventEditor, MilestoneEditor, NewMilestoneForm } from "./event-editor";
import { NewEventForm } from "./new-event-form";

// Supabase를 연결하지 않은 샘플 모드에서는 고친 내용이 화면에만 남는다
const SAMPLE = !(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const nextDay = (d: string) => new Date(Date.parse(d) + 86_400_000).toISOString().slice(0, 10);
const COLOR = { platform_event: "var(--sentiment-positive)", own_campaign: "var(--risk-low)", milestone: "var(--risk-high)" };

// 홈에 넣을 때는 플랫폼 고르기·행사 추가·수정을 빼고 높이를 줄인다. 다 쓰려면 이 화면(전체보기)으로 온다.
// 홈은 머리줄(월·주 전환 · 이전 · 다음 · 범례)을 _home/home-calendar.tsx가 그리므로 기본 툴바를 끄고, 칸 높이만큼 늘어난다 (2026-10-26 홈 새 디자인 목업)
const VIEW = {
  page: { height: 640, headerToolbar: { left: "prev,next today", center: "title", right: "dayGridMonth,listMonth" } },
  home: { height: "auto", headerToolbar: false },
} as const;

// 홈 칸 안의 일정 칩. 색은 globals.css의 .fc-home 규칙이 정한다 (목업 색)
const HOME_CHIP = { platform_event: "home-chip-platform", own_campaign: "home-chip-own", milestone: "home-chip-prep", done: "home-chip-done" };

/** 홈 머리줄이 보기 전환 · 이전 · 다음을 부를 때 쓰는 값 */
export type CalendarControls = {
  view: "dayGridMonth" | "dayGridWeek";
  /** 보이는 기간의 첫날과, 마지막 날의 다음 날. 캘린더가 뜨기 전에는 null */
  start: Date | null;
  end: Date | null;
  prev: () => void;
  next: () => void;
  setView: (view: CalendarControls["view"]) => void;
};

export function PromoCalendar({
  events: initial,
  platformKeys,
  today,
  variant = "page",
  renderIdle,
  toolbar,
  panelId,
}: {
  events: PromoEventView[];
  platformKeys: string[];
  today: string;
  variant?: keyof typeof VIEW;
  /** 아무 일정도 고르지 않았을 때 오른쪽 패널에 보일 내용 (홈의 할 일). 없으면 안내 문구 */
  renderIdle?: (ctx: { events: PromoEventView[]; select: (eventId: string) => void }) => ReactNode;
  /** 홈: 캘린더 카드 맨 위 줄 (제목 · 보기 전환 · 이전 · 다음 · 범례). FullCalendar 기본 툴바 대신 */
  toolbar?: (controls: CalendarControls) => ReactNode;
  /** 홈: 할 일 카드의 id (상단 바 알림 버튼이 이 카드로 이동한다) */
  panelId?: string;
}) {
  const isPage = variant === "page";
  const [events, setEvents] = useState(initial);
  const [platform, setPlatform] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(() => new URLSearchParams(window.location.search).get("event"));
  const [adding, setAdding] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const calendarRef = useRef<FullCalendar>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<{ view: string; start: Date; end: Date } | null>(null);

  // 홈: FullCalendar는 창 크기가 바뀔 때만 폭을 다시 잰다. 사이드바를 접고 펴거나 옆 카드가 줄을 바꿔
  // 칸 폭만 바뀌면 오른쪽이 비므로, 감싼 칸의 크기를 지켜보다가 다시 재게 한다
  useEffect(() => {
    if (isPage || !wrapRef.current) return;
    // 높이만 바뀔 때(칸에 일정이 늘 때 등)는 다시 재지 않는다
    let width = 0;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next === width) return;
      width = next;
      calendarRef.current?.getApi().updateSize();
    });
    observer.observe(wrapRef.current);
    return () => observer.disconnect();
  }, [isPage]);

  const selected = events.find((e) => e.id === selectedId) ?? null;
  // 플랫폼 메모가 없는 플랫폼의 행사도 고를 수 있게 행사 쪽 플랫폼을 합친다
  const filterKeys = [...new Set([...platformKeys, ...events.flatMap((e) => (e.platformKey ? [e.platformKey] : []))])];
  const idle = !selected && renderIdle ? renderIdle({ events, select: setSelectedId }) : null;
  // 문구 관련 버튼은 광고 검토로 간다: 이 행사의 검토가 있으면 그 상세, 없으면 새 검토
  const adCheckHref = selected?.adCheck ? `/ad-check/${selected.adCheck.id}` : "/ad-check";

  const calendarEvents = useMemo<EventInput[]>(
    () =>
      events.filter((e) => !platform || e.platformKey === platform).flatMap((e) => [
        {
          id: e.id,
          title: `${e.isConfirmed ? "" : "예상 · "}${e.platformName} · ${e.title}`,
          start: e.startDate,
          end: nextDay(e.endDate),
          allDay: true,
          ...(isPage ? { color: COLOR[e.kind] } : { classNames: [HOME_CHIP[e.kind]] }),
        },
        ...e.milestones.map((m) => ({
          id: m.id,
          groupId: e.id,
          title: `${m.done ? "✓" : "▲"} ${m.label} (${e.title})`,
          start: m.dueDate,
          allDay: true,
          // 홈은 점 대신 칩으로 보인다
          ...(isPage
            ? { display: "list-item", color: m.done ? "var(--muted-foreground)" : COLOR.milestone }
            : { display: "block", classNames: [m.done ? HOME_CHIP.done : HOME_CHIP.milestone] }),
        })),
      ]),
    [events, platform, isPage],
  );

  const api = () => calendarRef.current?.getApi();
  const controls: CalendarControls = {
    view: range?.view === "dayGridWeek" ? "dayGridWeek" : "dayGridMonth",
    start: range?.start ?? null,
    end: range?.end ?? null,
    prev: () => api()?.prev(),
    next: () => api()?.next(),
    setView: (view) => api()?.changeView(view),
  };

  const patchEvent = (eventId: string, patch: Partial<PromoEventView>) =>
    setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, ...patch } : e)).toSorted((a, b) => a.startDate.localeCompare(b.startDate)));
  const setMilestones = (eventId: string, change: (list: MilestoneView[]) => MilestoneView[]) =>
    setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, milestones: change(e.milestones).toSorted((a, b) => a.dueDate.localeCompare(b.dueDate)) } : e)));
  const patchMilestone = (eventId: string, milestoneId: string, patch: Partial<MilestoneView>) =>
    setMilestones(eventId, (list) => list.map((m) => (m.id === milestoneId ? { ...m, ...patch } : m)));

  // 체크는 화면에 먼저 반영하고 저장을 뒤따라 부른다. 저장하지 못하면 되돌린다
  const toggleMilestone = (eventId: string, milestoneId: string, done: boolean) => {
    patchMilestone(eventId, milestoneId, { done });
    setToggleError(null);
    startTransition(async () => {
      const result = await setMilestoneDone(milestoneId, done);
      if (result.ok) return;
      patchMilestone(eventId, milestoneId, { done: !done });
      setToggleError(result.message);
    });
  };

  const calendar = (
      // 홈 칸 모양(둥근 칸 · 간격 · 오늘 테두리 · 칩)은 globals.css의 .fc-home 규칙
      <div ref={wrapRef} className={isPage ? "min-w-0" : "fc-home min-w-0"}>
        {/* 홈은 범례를 머리줄(toolbar)이 그린다 */}
        {isPage && (
          <div className="mb-3 flex items-center gap-2 text-sm">
            <label className="flex items-center gap-2">
              플랫폼
              <select className="rounded-md border bg-background px-2 py-1" value={platform} onChange={(e) => setPlatform(e.target.value)}>
                <option value="">전체</option>
                {filterKeys.map((k) => (
                  <option key={k} value={k}>
                    {platformLabel(k)}
                  </option>
                ))}
              </select>
            </label>
            <span className="ml-auto flex gap-3 text-xs text-muted-foreground">
              <span style={{ color: COLOR.platform_event }}>■ 플랫폼 행사</span>
              <span style={{ color: COLOR.own_campaign }}>■ 자사 캠페인</span>
              <span style={{ color: COLOR.milestone }}>▲ 준비 마감</span>
            </span>
            <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}>
              {adding ? "닫기" : "행사 추가"}
            </Button>
          </div>
        )}
        {isPage && adding && (
          <NewEventForm
            platformKeys={SAMPLE ? platformKeys : PLATFORMS.map((p) => p.id)}
            onCreated={(e) => {
              setEvents((prev) => [...prev, e].toSorted((a, b) => a.startDate.localeCompare(b.startDate)));
              setSelectedId(e.id);
              setAdding(false);
            }}
          />
        )}
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
          locale={koLocale}
          initialView="dayGridMonth"
          initialDate={selected?.startDate ?? today}
          now={today}
          headerToolbar={VIEW[variant].headerToolbar}
          height={VIEW[variant].height}
          events={calendarEvents}
          eventClick={(info) => setSelectedId(info.event.groupId || info.event.id)}
          datesSet={(info) => setRange({ view: info.view.type, start: info.view.currentStart, end: info.view.currentEnd })}
          // 홈: 그 달의 주만, 칸마다 일정 2개까지, 날짜는 "27일" 대신 "27". 칩 글자가 잘리면 마우스를 올려 본다
          fixedWeekCount={isPage}
          dayMaxEvents={isPage ? false : 2}
          dayCellContent={isPage ? undefined : (arg) => arg.dayNumberText.replace("일", "")}
          eventDidMount={
            isPage
              ? undefined
              : (info) => {
                  info.el.title = info.event.title;
                }
          }
        />
      </div>
  );

  const panel = (
      // 홈에서는 캘린더 옆에 따로 선 카드다. 좁은 화면에서는 캘린더 아래로 내려간다
      <Card id={panelId} className={isPage ? "h-fit" : "min-w-0 flex-[1_1_300px] scroll-mt-8"}>
        {!idle && (
          <CardHeader>
            {selected && renderIdle && (
              <button type="button" onClick={() => setSelectedId(null)} className="w-fit text-xs text-muted-foreground hover:text-foreground">
                ← 할 일 보기
              </button>
            )}
            <CardTitle>{selected ? selected.title : "일정을 눌러 보세요"}</CardTitle>
          </CardHeader>
        )}
        <CardContent className="space-y-3 text-sm">
          {selected ? (
            <>
              <p className="flex items-center gap-2 text-muted-foreground">
                {selected.platformKey ? `${selected.platformName} · ` : ""}
                {selected.kind === "own_campaign" ? "자사 캠페인" : "플랫폼 행사"}
                {/* 플랫폼 공지 전, 지난 행사 패턴으로 넣은 날짜 */}
                {!selected.isConfirmed && <Badge variant="outline">예상</Badge>}
              </p>
              <p>
                {selected.startDate} ~ {selected.endDate} ({dDay(selected.startDate)})
              </p>
              {isPage ? (
                <EventEditor
                  key={selected.id}
                  event={selected}
                  onChange={(patch) => patchEvent(selected.id, patch)}
                  onDeleted={() => {
                    setEvents((prev) => prev.filter((e) => e.id !== selected.id));
                    setSelectedId(null);
                  }}
                />
              ) : (
                <Link href={`/calendar?event=${selected.id}`} className={buttonVariants({ variant: "outline", size: "xs" })}>
                  수정 · 삭제는 일정 관리에서 →
                </Link>
              )}
              <div>
                <p className="mb-1 font-medium">준비 마감</p>
                <ul className="space-y-1">
                  {selected.milestones.map((m) => {
                    const row = (
                      <>
                        <label className="flex flex-1 items-center gap-2">
                          <input type="checkbox" checked={m.done} onChange={(e) => toggleMilestone(selected.id, m.id, e.target.checked)} />
                          <span className={m.done ? "text-muted-foreground line-through" : ""}>
                            {m.label} · {m.dueDate} ({dDay(m.dueDate)})
                          </span>
                        </label>
                        {/* 쿠폰 설정·물류 입고 같은 마감은 갈 화면이 없어 체크만 한다 */}
                        {m.label.includes("문구") && (
                          <Link href={adCheckHref} className={`${buttonVariants({ variant: "outline", size: "xs" })} shrink-0`}>
                            광고 검토로 →
                          </Link>
                        )}
                      </>
                    );
                    return isPage ? (
                      <MilestoneEditor
                        key={m.id}
                        milestone={m}
                        onChange={(patch) => patchMilestone(selected.id, m.id, patch)}
                        onDeleted={() => setMilestones(selected.id, (list) => list.filter((x) => x.id !== m.id))}
                      >
                        {row}
                      </MilestoneEditor>
                    ) : (
                      <li key={m.id} className="flex items-center gap-2">
                        {row}
                      </li>
                    );
                  })}
                </ul>
                {toggleError && (
                  <p role="alert" className="mt-1 text-xs text-destructive">
                    {toggleError}
                  </p>
                )}
                {isPage && (
                  <div className="mt-2">
                    <NewMilestoneForm key={selected.id} eventId={selected.id} onAdded={(m) => setMilestones(selected.id, (list) => [...list, m])} />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">행사용 문구</span>
                {selected.adCheck ? (
                  <StatusBadge status={selected.adCheck.status} />
                ) : (
                  <span className="text-xs text-muted-foreground">검토 없음</span>
                )}
                <Link href={adCheckHref} className={`${buttonVariants({ variant: "outline", size: "xs" })} ml-auto shrink-0`}>
                  {selected.adCheck ? "검토 상세 →" : "새 검토 만들기 →"}
                </Link>
              </div>
              {SAMPLE && <p className="text-xs text-muted-foreground">샘플 모드라 체크 · 추가 · 수정은 새로고침하면 사라져요</p>}
            </>
          ) : (
            (idle ?? <p className="text-muted-foreground">행사 막대나 ▲ 마감을 누르면 준비 상황이 여기 보여요.</p>)
          )}
        </CardContent>
      </Card>
  );

  // 홈: 캘린더 카드와 할 일 카드를 나란히 (2026-10-26 홈 새 디자인)
  if (!isPage) {
    return (
      <div className="flex flex-wrap items-stretch gap-5">
        <Card className="min-w-0 flex-[999_1_600px]">
          {toolbar && <CardHeader>{toolbar(controls)}</CardHeader>}
          <CardContent>{calendar}</CardContent>
        </Card>
        {panel}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[1fr_20rem] gap-4">
      {calendar}
      {panel}
    </div>
  );
}
