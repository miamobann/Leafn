"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { activeHref, groupOf, type NavRole, visibleItems } from "./nav-config";

/**
 * 탭(사이드바 그룹) 화면 맨 위의 하위 메뉴 버튼 줄. 화면 틀(layout.tsx)이 그리므로 각 화면 파일은 고치지 않는다.
 * 그룹에 속하지 않는 화면(홈, 자료실, 설정)에서는 그리지 않는다
 */
export function SectionTabs({ role }: { role: NavRole }) {
  const current = activeHref(usePathname());
  const group = groupOf(current);
  if (!group) return null;

  const items = visibleItems(group, role);
  const tabs = items.filter((item) => !item.external);
  const links = items.filter((item) => item.external);

  return (
    <nav aria-label={`${group.label} 하위 메뉴`} className="mb-6 flex items-center gap-1">
      {tabs.map((item) => {
        const active = item.href === current;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex h-9 items-center rounded-full px-4 text-sm whitespace-nowrap ${
              active
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
      {/* 새 창으로 여는 메뉴(공개 설문)는 줄 오른쪽 끝의 주 버튼으로 둔다 */}
      {links.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          target="_blank"
          className={cn(buttonVariants(), "ml-auto whitespace-nowrap")}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
