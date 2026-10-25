"use client";

import Link from "next/link";
import { type ReactNode, useMemo, useState, useTransition } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import koLocale from "@fullcalendar/core/locales/ko";
import type { EventInput } from "@fullcalendar/core";
import { StatusBadge } from "@/components/common/badges";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PromoEventView } from "@/lib/data/launch";
import { setMilestoneDone } from "@/lib/data/launch-actions";
import { dDay } from "@/lib/format";
import { NewEventForm } from "./new-event-form";

const nextDay = (d: string) => new Date(Date.parse(d) + 86_400_000).toISOString().slice(0, 10);
const COLOR = { platform_event: "var(--sentiment-positive)", own_campaign: "var(--risk-low)", milestone: "var(--risk-high)" };

// 홈에 넣을 때는 플랫폼 고르기·행사 추가·보기 전환을 빼고 높이를 줄인다. 다 쓰려면 이 화면(전체보기)으로 온다
const VIEW = {
  page: { height: 640, headerToolbar: { left: "prev,next today", center: "title", right: "dayGridMonth,listMonth" } },
  home: { height: 520, headerToolbar: { left: "prev,next today", center: "title", right: "" } },
};

export function PromoCalendar({
  events: initial,
  platformKeys,
  today,
  variant = "page",
  renderIdle,
}: {
  events: PromoEventView[];
  platformKeys: string[];
  today: string;
  variant?: keyof typeof VIEW;
  /** 아무 일정도 고르지 않았을 때 오른쪽 패널에 보일 내용 (홈의 다음 행사·할 일). 없으면 안내 문구 */
  renderIdle?: (ctx: { events: PromoEventView[]; select: (eventId: string) => void }) => ReactNode;
}) {
  const isPage = variant === "page";
  const [events, setEvents] = useState(initial);
  const [platform, setPlatform] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(() => new URLSearchParams(window.location.search).get("event"));
  const [adding, setAdding] = useState(false);
  const [, startTransition] = useTransition();

  const selected = events.find((e) => e.id === selectedId) ?? null;
  const idle = !selected && renderIdle ? renderIdle({ events, select: setSelectedId }) : null;
  // 문구 관련 버튼은 광고 검토로 간다: 이 행사의 검토가 있으면 그 상세, 없으면 새 검토
  const adCheckHref = selected?.adCheck ? `/ad-check/${selected.adCheck.id}` : "/ad-check";

  const calendarEvents = useMemo<EventInput[]>(
    () =>
      events.filter((e) => !platform || e.platformKey === platform).flatMap((e) => [
        { id: e.id, title: `${e.platformName} · ${e.title}`, start: e.startDate, end: nextDay(e.endDate), allDay: true, color: COLOR[e.kind] },
        ...e.milestones.map((m) => ({
          id: m.id,
          groupId: e.id,
          title: `${m.done ? "✓" : "▲"} ${m.label} (${e.title})`,
          start: m.dueDate,
          allDay: true,
          display: "list-item",
          color: m.done ? "var(--muted-foreground)" : COLOR.milestone,
        })),
      ]),
    [events, platform],
  );

  // 체크는 화면에 먼저 반영하고 저장을 뒤따라 부른다
  const toggleMilestone = (eventId: string, milestoneId: string, done: boolean) => {
    setEvents((prev) =>
      prev.map((e) => (e.id !== eventId ? e : { ...e, milestones: e.milestones.map((m) => (m.id === milestoneId ? { ...m, done } : m)) })),
    );
    startTransition(async () => {
      await setMilestoneDone(milestoneId, done);
    });
  };

  return (
    <div className="grid grid-cols-[1fr_20rem] gap-4">
      <div>
        <div className="mb-3 flex items-center gap-2 text-sm">
          {isPage && (
            <label className="flex items-center gap-2">
              플랫폼
              <select className="rounded-md border bg-background px-2 py-1" value={platform} onChange={(e) => setPlatform(e.target.value)}>
                <option value="">전체</option>
                {platformKeys.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
          )}
          <span className="ml-auto flex gap-3 text-xs text-muted-foreground">
            <span style={{ color: COLOR.platform_event }}>■ 플랫폼 행사</span>
            <span style={{ color: COLOR.own_campaign }}>■ 자사 캠페인</span>
            <span style={{ color: COLOR.milestone }}>▲ 준비 마감</span>
          </span>
          {isPage && (
            <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}>
              {adding ? "닫기" : "행사 추가"}
            </Button>
          )}
        </div>
        {isPage && adding && (
          <NewEventForm
            platformKeys={platformKeys}
            onCreated={(e) => {
              setEvents((prev) => [...prev, e].toSorted((a, b) => a.startDate.localeCompare(b.startDate)));
              setSelectedId(e.id);
              setAdding(false);
            }}
          />
        )}
        <FullCalendar
          plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
          locale={koLocale}
          initialView="dayGridMonth"
          initialDate={selected?.startDate ?? today}
          now={today}
          headerToolbar={VIEW[variant].headerToolbar}
          height={VIEW[variant].height}
          events={calendarEvents}
          eventClick={(info) => setSelectedId(info.event.groupId || info.event.id)}
        />
      </div>

      {/* 홈에서는 바깥 카드 안에 들어가므로 테두리를 왼쪽 선 하나로 줄인다 */}
      <Card className={isPage ? "h-fit" : "h-fit gap-4 rounded-none border-l bg-transparent py-0 ring-0"}>
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
              <p className="text-muted-foreground">
                {selected.platformKey ? `${selected.platformName} · ` : ""}
                {selected.kind === "own_campaign" ? "자사 캠페인" : "플랫폼 행사"}
              </p>
              <p>
                {selected.startDate} ~ {selected.endDate} ({dDay(selected.startDate)})
              </p>
              <div>
                <p className="mb-1 font-medium">준비 마감</p>
                <ul className="space-y-1">
                  {selected.milestones.map((m) => (
                    <li key={m.id} className="flex items-center gap-2">
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
                    </li>
                  ))}
                </ul>
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
              <p className="text-xs text-muted-foreground">체크와 추가는 샘플이라 새로고침하면 사라져요 (DB 연결 전)</p>
            </>
          ) : (
            (idle ?? <p className="text-muted-foreground">행사 막대나 ▲ 마감을 누르면 준비 상황이 여기 보여요.</p>)
          )}
        </CardContent>
      </Card>
    </div>
  );
}
