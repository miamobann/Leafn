"use client";

import { Collapsible } from "@base-ui/react/collapsible";
import { ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { FOOTER_ITEMS, HOME_ITEM, NAV_GROUPS, type NavGroup, type NavItem } from "./nav-config";

const ALL_HREFS = [HOME_ITEM, ...NAV_GROUPS.flatMap((g) => g.items), ...FOOTER_ITEMS].map(
  (item) => item.href,
);

const TEXT = {
  collapse: "사이드바 접기",
  expand: "사이드바 펼치기",
};

const NAV_ID = "app-sidebar-nav";

// 펼친 그룹과 사이드바 접힘 여부는 이 브라우저에만 기억한다. 저장소를 못 쓰는 환경이면 기억하지 않고 넘어간다
const OPEN_GROUPS_KEY = "leafn.sidebar.open-groups";
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

function readOpenGroups(): string[] {
  const saved = readSaved(OPEN_GROUPS_KEY);
  return Array.isArray(saved) ? saved.filter((label): label is string => typeof label === "string") : [];
}

function matches(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

// "/reviews/compare"에서 "/reviews"까지 켜지지 않도록 가장 긴 메뉴 경로 하나만 활성화한다
function activeHref(pathname: string): string | undefined {
  return ALL_HREFS.filter((href) => matches(pathname, href)).sort((a, b) => b.length - a.length)[0];
}

function groupOf(href: string | undefined): string | undefined {
  return NAV_GROUPS.find((g) => g.items.some((item) => item.href === href))?.label;
}

function NavLink({ item, active, nested = false }: { item: NavItem; active: boolean; nested?: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      target={item.external ? "_blank" : undefined}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2 rounded-md py-1.5 text-sm whitespace-nowrap ${nested ? "px-2" : "px-3"} ${
        active ? "bg-sidebar-accent font-medium" : "text-muted-foreground hover:bg-sidebar-accent"
      }`}
    >
      {Icon && <Icon aria-hidden className="size-4 shrink-0" />}
      {item.label}
    </Link>
  );
}

function NavGroupTree({
  group,
  current,
  open,
  onOpenChange,
}: {
  group: NavGroup;
  current: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    // 트리 선 색: 반투명이면 선이 겹치는 곳이 진해지므로, 같은 밝기의 불투명한 색을 토큰끼리 섞어 만든다
    <Collapsible.Root
      open={open}
      onOpenChange={onOpenChange}
      className="[--tree-line:color-mix(in_oklab,var(--muted-foreground)_35%,var(--sidebar))]"
    >
      {/* 펼쳤을 때 그룹 아이콘 바로 아래부터 하위 메뉴의 세로선이 이어지도록, 아이콘 아래 틈(8px)에 선을 미리 그린다 */}
      <Collapsible.Trigger className="group relative flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm whitespace-nowrap hover:bg-sidebar-accent data-[panel-open]:after:absolute data-[panel-open]:after:top-6 data-[panel-open]:after:bottom-0 data-[panel-open]:after:left-5 data-[panel-open]:after:border-l data-[panel-open]:after:border-(--tree-line)">
        <group.icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        {group.label}
        <ChevronRight
          aria-hidden
          className="ml-auto size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-90 motion-reduce:transition-none"
        />
      </Collapsible.Trigger>
      <Collapsible.Panel className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-150 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0 motion-reduce:transition-none">
        {/* 터미널 트리(├─ └─)처럼 잇되 꺾이는 곳은 둥글게. 세로선은 그룹 아이콘(16px) 가운데에 맞춘다.
            마지막 메뉴 전까지는 줄기(after)가 끊기지 않고 지나가고, 가지(before)는 줄기와 겹치지 않게 꺾이는 6px만 그린다.
            마지막 메뉴는 줄기 없이 가지가 위에서부터 내려와 꺾인다 */}
        <ul className="ml-5 pb-0.5">
          {group.items.map((item) => (
            <li
              key={item.href}
              className="relative pl-2.5 before:absolute before:top-0 before:left-0 before:h-1/2 before:w-2.5 before:rounded-bl-sm before:border-b before:border-l before:border-(--tree-line) not-last:before:top-[calc(50%-0.375rem)] not-last:before:h-1.5 not-last:after:absolute not-last:after:top-0 not-last:after:bottom-0 not-last:after:left-0 not-last:after:border-l not-last:after:border-(--tree-line)"
            >
              <NavLink item={item} active={current === item.href} nested />
            </li>
          ))}
        </ul>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}

const RAIL_BUTTON = "flex size-9 items-center justify-center rounded-md";

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
      <Icon aria-hidden className="size-4" />
    </Link>
  );
}

export function AppSidebar() {
  const current = activeHref(usePathname());
  const currentGroup = groupOf(current);
  const [openGroups, setOpenGroups] = useState<string[]>(currentGroup ? [currentGroup] : []);
  const [collapsed, setCollapsed] = useState(false);
  // 기억해 둔 접힘 상태를 불러올 때는 움직이지 않고, 사용자가 직접 누를 때만 폭이 미끄러지듯 바뀐다
  const [animateWidth, setAnimateWidth] = useState(false);

  // 서버 화면과 어긋나지 않도록, 기억해 둔 상태는 화면이 뜬 뒤에 불러온다
  useEffect(() => {
    setOpenGroups((prev) => [...new Set([...readOpenGroups(), ...prev])]);
    setCollapsed(readSaved(COLLAPSED_KEY) === true);
  }, []);

  // 지금 보는 화면의 그룹은 자동으로 펼친다
  useEffect(() => {
    if (currentGroup) setOpenGroups((prev) => (prev.includes(currentGroup) ? prev : [...prev, currentGroup]));
  }, [currentGroup]);

  function setGroupOpen(label: string, open: boolean) {
    const next = open ? [...openGroups, label] : openGroups.filter((l) => l !== label);
    setOpenGroups(next);
    save(OPEN_GROUPS_KEY, next);
  }

  function setSidebarCollapsed(next: boolean) {
    setAnimateWidth(true);
    setCollapsed(next);
    save(COLLAPSED_KEY, next);
  }

  // 접은 줄에서 그룹 아이콘을 누르면 사이드바를 펼치고 그 그룹을 연다
  function openGroupFromRail(label: string) {
    if (!openGroups.includes(label)) setGroupOpen(label, true);
    setSidebarCollapsed(false);
  }

  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <aside
      className={`flex shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar ${
        animateWidth ? "transition-[width] duration-200 ease-out motion-reduce:transition-none" : ""
      } ${collapsed ? "w-14" : "w-60"}`}
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
        <nav id={NAV_ID} className="flex flex-1 flex-col items-center gap-1 overflow-y-auto px-2 pb-4">
          <RailLink item={HOME_ITEM} active={current === HOME_ITEM.href} />
          {NAV_GROUPS.map((group) => (
            <button
              key={group.label}
              type="button"
              onClick={() => openGroupFromRail(group.label)}
              aria-label={group.label}
              title={group.label}
              className={`${RAIL_BUTTON} ${
                currentGroup === group.label ? "bg-sidebar-accent" : "text-muted-foreground hover:bg-sidebar-accent"
              }`}
            >
              <group.icon aria-hidden className="size-4" />
            </button>
          ))}
          <div className="mt-3 flex w-full flex-col items-center gap-1 border-t border-border pt-3">
            {FOOTER_ITEMS.map((item) => (
              <RailLink key={item.href} item={item} active={current === item.href} />
            ))}
          </div>
        </nav>
      ) : (
        <nav id={NAV_ID} className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-4">
          <NavLink item={HOME_ITEM} active={current === HOME_ITEM.href} />
          {NAV_GROUPS.map((group) => (
            <NavGroupTree
              key={group.label}
              group={group}
              current={current}
              open={openGroups.includes(group.label)}
              onOpenChange={(open) => setGroupOpen(group.label, open)}
            />
          ))}
          <div className="mt-3 border-t border-border pt-3">
            {FOOTER_ITEMS.map((item) => (
              <NavLink key={item.href} item={item} active={current === item.href} />
            ))}
          </div>
        </nav>
      )}
    </aside>
  );
}
