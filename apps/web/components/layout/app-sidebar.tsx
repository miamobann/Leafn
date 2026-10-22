"use client";

import { Collapsible } from "@base-ui/react/collapsible";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { FOOTER_ITEMS, HOME_ITEM, NAV_GROUPS, type NavGroup, type NavItem } from "./nav-config";

const ALL_HREFS = [HOME_ITEM, ...NAV_GROUPS.flatMap((g) => g.items), ...FOOTER_ITEMS].map(
  (item) => item.href,
);

// 펼친 그룹은 이 브라우저에만 기억한다. 저장소를 못 쓰는 환경이면 기억하지 않고 넘어간다
const OPEN_GROUPS_KEY = "leafn.sidebar.open-groups";

function readOpenGroups(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(OPEN_GROUPS_KEY) ?? "[]");
    return Array.isArray(saved) ? saved.filter((label): label is string => typeof label === "string") : [];
  } catch {
    return [];
  }
}

function saveOpenGroups(labels: string[]) {
  try {
    localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(labels));
  } catch {
    // 기억하지 못해도 사이드바는 그대로 동작한다
  }
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

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      target={item.external ? "_blank" : undefined}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm ${
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
    <Collapsible.Root open={open} onOpenChange={onOpenChange}>
      <Collapsible.Trigger className="group flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm hover:bg-sidebar-accent">
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-90 motion-reduce:transition-none"
        />
        {group.label}
      </Collapsible.Trigger>
      <Collapsible.Panel className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-150 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0 motion-reduce:transition-none">
        {/* 왼쪽 세로선이 하위 메뉴의 안내선이다. 아이콘(16px) 가운데에 맞춘다 */}
        <div className="ml-5 border-l border-border py-0.5 pl-2">
          {group.items.map((item) => (
            <NavLink key={item.href} item={item} active={current === item.href} />
          ))}
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}

export function AppSidebar() {
  const current = activeHref(usePathname());
  const currentGroup = groupOf(current);
  const [openGroups, setOpenGroups] = useState<string[]>(currentGroup ? [currentGroup] : []);

  // 서버 화면과 어긋나지 않도록, 기억해 둔 펼침 상태는 화면이 뜬 뒤에 불러온다
  useEffect(() => {
    setOpenGroups((prev) => [...new Set([...readOpenGroups(), ...prev])]);
  }, []);

  // 지금 보는 화면의 그룹은 자동으로 펼친다
  useEffect(() => {
    if (currentGroup) setOpenGroups((prev) => (prev.includes(currentGroup) ? prev : [...prev, currentGroup]));
  }, [currentGroup]);

  function setGroupOpen(label: string, open: boolean) {
    const next = open ? [...openGroups, label] : openGroups.filter((l) => l !== label);
    setOpenGroups(next);
    saveOpenGroups(next);
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="px-5 py-4 text-lg font-semibold">Leafn</div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-4">
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
    </aside>
  );
}
