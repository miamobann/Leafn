"use client";

// 상단 헤더의 프로젝트(제품군) 선택 메뉴. 고른 프로젝트는 이 브라우저에 기억한다 (project-store.ts)
import { Check, ChevronDown, ListChecks, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { type ProjectWithProducts, useProjects } from "./project-store";

const TEXT = {
  menu: "프로젝트",
  menuTitle: "프로젝트 고르기",
  products: (n: number) => `제품 ${n}종`,
  manage: "프로젝트·제품 관리",
  addProject: "새 프로젝트",
  empty: "프로젝트 없음",
};

const MENU_ID = "project-switcher-menu";

export function ProjectSwitcher({ base }: { base: ProjectWithProducts[] }) {
  const { projects, current, select } = useProjects(base);
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
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={MENU_ID}
        aria-label={`${TEXT.menu}: ${current?.name ?? TEXT.empty}`}
        className="flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
      >
        {current?.name ?? TEXT.empty}
        {current && <span className="font-normal text-muted-foreground">{TEXT.products(current.products.length)}</span>}
        <ChevronDown aria-hidden className="size-4 text-muted-foreground" />
      </button>
      {open && (
        <div
          id={MENU_ID}
          className="absolute top-full left-0 z-30 mt-1.5 w-72 rounded-lg border border-border bg-background p-1.5 shadow-lg"
        >
          <p className="px-2 pt-1 pb-1.5 text-xs text-muted-foreground">{TEXT.menuTitle}</p>
          <ul>
            {projects.map((project) => (
              <li key={project.id}>
                <button
                  type="button"
                  onClick={() => {
                    select(project.id);
                    setOpen(false);
                  }}
                  aria-current={project.id === current?.id ? "true" : undefined}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted ${
                    project.id === current?.id ? "bg-muted" : ""
                  }`}
                >
                  <Check aria-hidden className={`size-4 shrink-0 ${project.id === current?.id ? "" : "invisible"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{project.name}</span>
                    <span className="block text-xs text-muted-foreground">{TEXT.products(project.products.length)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="my-1.5 h-px bg-border" />
          <Link href="/projects" className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted">
            <ListChecks aria-hidden className="size-4" />
            {TEXT.manage}
          </Link>
          <Link href="/projects?new=project" className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted">
            <Plus aria-hidden className="size-4" />
            {TEXT.addProject}
          </Link>
        </div>
      )}
    </div>
  );
}
