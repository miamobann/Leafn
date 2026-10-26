"use client";

import { History, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatDate } from "@/lib/format";
import { activeHref, FOOTER_ITEMS, groupOf, HOME_ITEM, NAV_GROUPS, type NavGroup, type NavItem, type NavRole, visibleItems } from "./nav-config";

const TEXT = {
  collapse: "사이드바 접기",
  expand: "사이드바 펼치기",
  activity: "최근 활동",
  noActivity: "아직 활동이 없어요",
};

const NAV_ID = "app-sidebar-nav";
const ACTIVITY_POPOVER_ID = "app-sidebar-activity";

// 사이드바 접힘 여부는 이 브라우저에만 기억한다. 저장소를 못 쓰는 환경이면 기억하지 않고 넘어간다
const COLLAPSED_KEY = "leafn.sidebar.collapsed";

function readSaved(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 기억하지 못해도 사이드바는 그대로 동작한다
  }
}

export type SidebarActivity = { id: string; actor_name: string; action: string; created_at: string };

/** 그룹 줄은 그 탭의 (그 역할에게 보이는) 첫 메뉴로 가는 링크다. 하위 메뉴는 탭 위 버튼 줄(section-tabs.tsx)에 나온다 */
function groupLink(group: NavGroup, role: NavRole): NavItem {
  return { label: group.label, href: visibleItems(group, role)[0].href, icon: group.icon };
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      target={item.external ? "_blank" : undefined}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm whitespace-nowrap ${
        active ? "bg-sidebar-accent font-medium" : "text-muted-foreground hover:bg-sidebar-accent"
      }`}
    >
      {Icon && <Icon aria-hidden className="size-4 shrink-0" />}
      {item.label}
    </Link>
  );
}

// 접은 줄의 칸은 펼친 메뉴 한 줄과 같은 크기(높이 32px, 좌우 12px 여백)로 둔다.
// 그래야 접고 펼 때 아이콘이 위아래·좌우로 움직이지 않는다 (아이콘 가운데 = 사이드바 왼쪽에서 32px).
// 오른쪽 테두리 1px 때문에 아이콘 자리가 15px로 좁아지므로, 아이콘에 shrink-0을 줘서 16px 그대로 둔다
const RAIL_BUTTON = "flex h-8 w-full items-center rounded-md px-3";

/** 접은 사이드바의 아이콘 한 칸. 글자가 없으므로 aria-label과 title로 이름을 알린다 */
function RailLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  if (!Icon) return null;
  return (
    <Link
      href={item.href}
      aria-label={item.label}
      title={item.label}
      aria-current={active ? "page" : undefined}
      className={`${RAIL_BUTTON} ${active ? "bg-sidebar-accent" : "text-muted-foreground hover:bg-sidebar-accent"}`}
    >
      <Icon aria-hidden className="size-4 shrink-0" />
    </Link>
  );
}

function ActivityList({ items }: { items: SidebarActivity[] }) {
  if (items.length === 0) return <p className="px-2 py-1.5 text-xs text-muted-foreground">{TEXT.noActivity}</p>;
  return (
    <ul className="space-y-0.5">
      {items.map((a) => (
        <li key={a.id} className="flex items-start gap-2 rounded-md px-2 py-1.5">
          <span
            aria-hidden
            className="flex size-5.5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium"
          >
            {a.actor_name.slice(0, 1)}
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] leading-snug">
              {a.actor_name} · {a.action}
            </span>
            <span className="block text-xs text-muted-foreground">{formatDate(a.created_at)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** 접은 사이드바 맨 아래의 최근 활동 아이콘. 누르면 사이드바 오른쪽에 목록이 열린다 */
function RailActivity({ items }: { items: SidebarActivity[] }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // 다른 화면으로 가면 닫는다
  useEffect(() => setOpen(false), [pathname]);

  // 열려 있는 동안 Esc나 바깥 클릭으로 닫는다
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={boxRef} className="relative border-t border-border px-3 pt-3 pb-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`${TEXT.activity} ${items.length}건`}
        title={TEXT.activity}
        aria-expanded={open}
        aria-controls={ACTIVITY_POPOVER_ID}
        className={`${RAIL_BUTTON} ${open ? "bg-sidebar-accent" : "text-muted-foreground hover:bg-sidebar-accent"}`}
      >
        <History aria-hidden className="size-4 shrink-0" />
      </button>
      {open && (
        <section
          id={ACTIVITY_POPOVER_ID}
          aria-label={TEXT.activity}
          className="absolute bottom-3 left-full z-20 ml-2 w-68 rounded-lg border border-border bg-background p-1.5 shadow-lg"
        >
          <h2 className="px-2 pt-1 pb-1.5 text-xs font-medium text-muted-foreground">{TEXT.activity}</h2>
          <ActivityList items={items} />
        </section>
      )}
    </div>
  );
}

export function AppSidebar({ activity, role }: { activity: SidebarActivity[]; role: NavRole }) {
  const current = activeHref(usePathname());
  const currentGroup = groupOf(current)?.label;
  const [collapsed, setCollapsed] = useState(false);
  // 기억해 둔 접힘 상태를 불러올 때는 움직이지 않고, 사용자가 직접 누를 때만 폭이 미끄러지듯 바뀐다
  const [animateWidth, setAnimateWidth] = useState(false);

  // 서버 화면과 어긋나지 않도록, 기억해 둔 상태는 화면이 뜬 뒤에 불러온다
  useEffect(() => {
    setCollapsed(readSaved(COLLAPSED_KEY) === true);
  }, []);

  function setSidebarCollapsed(next: boolean) {
    setAnimateWidth(true);
    setCollapsed(next);
    save(COLLAPSED_KEY, next);
  }

  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    // 펼친 상태는 폭이 바뀌는 동안 글자가 넘치지 않게 자르고, 접은 상태는 최근 활동 목록이 오른쪽으로 나올 수 있게 둔다
    <aside
      className={`flex shrink-0 flex-col border-r border-border bg-sidebar ${collapsed ? "w-16" : "w-60 overflow-hidden"} ${
        animateWidth ? "transition-[width] duration-200 ease-out motion-reduce:transition-none" : ""
      }`}
    >
      <div className={`flex items-center py-4 ${collapsed ? "justify-center px-2" : "justify-between pr-3 pl-5"}`}>
        {!collapsed && <span className="text-lg font-semibold">Leafn</span>}
        <button
          type="button"
          onClick={() => setSidebarCollapsed(!collapsed)}
          aria-label={collapsed ? TEXT.expand : TEXT.collapse}
          title={collapsed ? TEXT.expand : TEXT.collapse}
          aria-expanded={!collapsed}
          aria-controls={NAV_ID}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent"
        >
          <ToggleIcon aria-hidden className="size-4" />
        </button>
      </div>

      {collapsed ? (
        <>
          <nav id={NAV_ID} className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-4">
            <RailLink item={HOME_ITEM} active={current === HOME_ITEM.href} />
            {NAV_GROUPS.map((group) => (
              <RailLink key={group.label} item={groupLink(group, role)} active={currentGroup === group.label} />
            ))}
            <div className="mt-3 border-t border-border pt-3">
              {FOOTER_ITEMS.map((item) => (
                <RailLink key={item.href} item={item} active={current === item.href} />
              ))}
            </div>
          </nav>
          <RailActivity items={activity} />
        </>
      ) : (
        <>
          <nav id={NAV_ID} className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-4">
            <NavLink item={HOME_ITEM} active={current === HOME_ITEM.href} />
            {NAV_GROUPS.map((group) => (
              <NavLink key={group.label} item={groupLink(group, role)} active={currentGroup === group.label} />
            ))}
            <div className="mt-3 border-t border-border pt-3">
              {FOOTER_ITEMS.map((item) => (
                <NavLink key={item.href} item={item} active={current === item.href} />
              ))}
            </div>
          </nav>
          <section aria-labelledby="app-sidebar-activity-title" className="border-t border-border px-3 pt-3 pb-4">
            <h2 id="app-sidebar-activity-title" className="px-2 pb-1.5 text-xs font-medium text-muted-foreground">
              {TEXT.activity}
            </h2>
            <ActivityList items={activity} />
          </section>
        </>
      )}
    </aside>
  );
}
