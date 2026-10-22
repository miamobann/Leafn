"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FOOTER_ITEMS, HOME_ITEM, NAV_GROUPS, type NavItem } from "./nav-config";

const ALL_HREFS = [HOME_ITEM, ...NAV_GROUPS.flatMap((g) => g.items), ...FOOTER_ITEMS].map(
  (item) => item.href,
);

function matches(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

// "/reviews/compare"에서 "/reviews"까지 켜지지 않도록 가장 긴 메뉴 경로 하나만 활성화한다
function activeHref(pathname: string): string | undefined {
  return ALL_HREFS.filter((href) => matches(pathname, href)).sort((a, b) => b.length - a.length)[0];
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      target={item.external ? "_blank" : undefined}
      aria-current={active ? "page" : undefined}
      className={`block rounded-md px-3 py-1.5 text-sm ${
        active ? "bg-sidebar-accent font-medium" : "text-muted hover:bg-sidebar-accent"
      }`}
    >
      {item.label}
    </Link>
  );
}

export function AppSidebar() {
  const current = activeHref(usePathname());

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="px-5 py-4 text-lg font-semibold">Leafn</div>
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 pb-4">
        <NavLink item={HOME_ITEM} active={current === HOME_ITEM.href} />
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="px-3 pb-1 text-xs font-medium text-muted">{group.label}</div>
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} active={current === item.href} />
            ))}
          </div>
        ))}
        <div className="mt-auto border-t border-border pt-3">
          {FOOTER_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} active={current === item.href} />
          ))}
        </div>
      </nav>
    </aside>
  );
}
