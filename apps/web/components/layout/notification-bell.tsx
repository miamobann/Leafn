"use client";

// 상단 바 알림 버튼과 "확인할 일" 패널 (2026-10-26 알림 패널 목업). 목록은 lib/data/notifications.ts가 모은다.
// 새 소식 점: 패널을 닫을 때(또는 모두 읽음) 그때 보인 항목을 이 브라우저에 기억하고, 그 뒤 새로 생긴 항목에만 붙인다
import { Bell } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import type { Notice } from "@/lib/data/notifications";

const TEXT = {
  title: "확인할 일",
  news: (n: number) => (n > 0 ? `새 소식 ${n}` : "새 소식 없음"),
  readAll: "모두 읽음",
  todo: "내가 처리할 일",
  results: "결과 소식",
  urgentFirst: "급한 순",
  recentFirst: "최근 순",
  empty: "지금 확인할 일이 없어요",
  label: (n: number) => (n > 0 ? `확인할 일 ${n}건` : "확인할 일 없음"),
  isNew: "새 소식",
};

const PANEL_ID = "notification-panel";
// 기억해 둔 항목 ID. 너무 쌓이지 않게 최근 것만 남긴다
const SEEN_KEY = "leafn.notifications.seen";
const SEEN_LIMIT = 300;
const SavedSeen = z.array(z.string());

// 칩 색은 공통 상태 배지(components/common/badges.tsx)와 같은 상태 색 15% 바탕
const TONE: Record<Notice["tone"], string> = {
  urgent: "bg-status-rejected/15 text-status-rejected",
  wait: "bg-status-pending/15 text-status-pending",
  ok: "bg-status-approved/15 text-status-approved",
  plain: "border border-border text-muted-foreground",
};
const WHEN: Record<Notice["tone"], string> = {
  urgent: "text-status-rejected",
  wait: "text-status-pending",
  ok: "text-muted-foreground",
  plain: "text-muted-foreground",
};

function readSeen(): Set<string> {
  try {
    const saved = SavedSeen.safeParse(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]"));
    return new Set(saved.success ? saved.data : []);
  } catch {
    return new Set();
  }
}

function saveSeen(ids: string[]) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-SEEN_LIMIT)));
  } catch {
    // 기억하지 못하면 다음에 열 때도 새 소식 점이 그대로 보인다
  }
}

export type NotificationLink = { label: string; href: string };

export function NotificationBell({
  count,
  todo,
  results,
  links,
}: {
  /** 처리할 일 수 (배지 숫자) */
  count: number;
  todo: Notice[];
  /** 팀원: 내 시안 결재 결과. 팀장은 빈 목록 */
  results: Notice[];
  /** 패널 아래 바로가기 */
  links: NotificationLink[];
}) {
  const [open, setOpen] = useState(false);
  // 화면이 뜨기 전에는 null: 서버 화면과 어긋나지 않게 점을 그리지 않는다
  const [seen, setSeen] = useState<Set<string> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const all = [...results, ...todo];
  const newCount = seen ? all.filter((n) => !seen.has(n.id)).length : 0;
  const urgent = all.some((n) => n.tone === "urgent");

  useEffect(() => setSeen(readSeen()), []);

  const markSeen = () => {
    const next = new Set([...(seen ?? []), ...all.map((n) => n.id)]);
    setSeen(next);
    saveSeen([...next]);
  };
  // 닫을 때 지금 본 항목을 기억한다. 열려 있는 동안은 점이 남아 무엇이 새것인지 보인다
  const close = () => {
    if (open) markSeen();
    setOpen(false);
  };

  // 다른 화면으로 가면 닫는다
  useEffect(() => setOpen(false), [pathname]);

  // 열려 있는 동안 Esc나 바깥 클릭으로 닫는다
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onPointer = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  });

  const row = (n: Notice) => {
    const isNew = seen !== null && !seen.has(n.id);
    return (
      <li key={n.id}>
        <Link
          href={n.href}
          onClick={close}
          className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg px-1.5 py-2 hover:bg-muted"
        >
          <span className={`rounded-full px-2 py-0.5 text-center text-[11px] whitespace-nowrap ${TONE[n.tone]}`}>{n.label}</span>
          <span className="min-w-0">
            {/* 새 소식 점은 제목 뒤에 둔다. 왼쪽에 점 칸을 두면 점이 없을 때 줄 전체가 오른쪽으로 밀려 보인다 */}
            <span className="flex items-center gap-1.5">
              <span lang={n.lang} className="truncate text-[13px] font-medium">
                {isNew && <span className="sr-only">{TEXT.isNew}: </span>}
                {n.title}
              </span>
              {isNew && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-primary" />}
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">{n.sub}</span>
          </span>
          <span className={`text-[11px] whitespace-nowrap tabular-nums ${WHEN[n.tone]}`}>{n.when}</span>
        </Link>
      </li>
    );
  };

  const section = (title: string, order: string, items: Notice[], shown = items.length) =>
    items.length > 0 && (
      <section aria-label={title}>
        <h3 className="mt-2.5 mb-1 flex justify-between px-1.5 text-xs font-normal text-muted-foreground">
          <span>
            {title} · {shown}
          </span>
          <span>{order}</span>
        </h3>
        <ul>{items.map(row)}</ul>
      </section>
    );

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={TEXT.label(count)}
        title={TEXT.label(count)}
        aria-expanded={open}
        aria-controls={PANEL_ID}
        className="relative inline-flex size-10 items-center justify-center rounded-full border border-border bg-card text-foreground hover:bg-muted"
      >
        <Bell aria-hidden className="size-[18px]" />
        {/* 급한 일(지난 마감 · 반려)이 있을 때만 빨간 배지 */}
        {count > 0 && (
          <span
            aria-hidden
            className={`absolute -top-1 -right-1.5 min-w-[18px] rounded-full px-1 text-center text-[11px] leading-[18px] font-medium text-white tabular-nums ${
              urgent ? "bg-status-rejected" : "bg-primary"
            }`}
          >
            {count}
          </span>
        )}
      </button>
      {open && (
        <div
          id={PANEL_ID}
          role="region"
          aria-label={TEXT.title}
          className="absolute top-full right-0 z-50 mt-2 w-[420px] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-popover p-2.5 text-popover-foreground shadow-lg"
        >
          <div className="flex items-center gap-2 border-b border-border px-1.5 pb-2">
            <h2 className="text-[15px] font-medium">{TEXT.title}</h2>
            <span aria-live="polite" className="text-xs text-muted-foreground">
              {TEXT.news(newCount)}
            </span>
            <button
              type="button"
              onClick={markSeen}
              disabled={newCount === 0}
              className="ml-auto rounded-full border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50"
            >
              {TEXT.readAll}
            </button>
          </div>
          <div className="max-h-[min(28rem,calc(100vh-8rem))] overflow-y-auto">
            {all.length === 0 ? (
              <p className="px-1.5 py-6 text-center text-sm text-muted-foreground">{TEXT.empty}</p>
            ) : (
              <>
                {section(TEXT.results, TEXT.recentFirst, results)}
                {section(TEXT.todo, TEXT.urgentFirst, todo, count)}
              </>
            )}
          </div>
          <nav aria-label={`${TEXT.title} 바로가기`} className="mt-1 flex justify-end gap-3.5 border-t border-border px-1.5 pt-2 text-xs">
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={close} className="font-medium hover:underline">
                {l.label} →
              </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
