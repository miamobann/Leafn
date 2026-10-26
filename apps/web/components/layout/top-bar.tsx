// 상단 헤더: 워크스페이스 / 프로젝트(제품군) 선택. 워크스페이스 → 프로젝트 → 제품 구조 (2026-10-24 총괄 결정)
// 오른쪽: 알림 버튼과 계정 (2026-10-26 홈 새 디자인. 데이터 표시 배지는 뺐다)
import { Bell } from "lucide-react";
import Link from "next/link";
import { getAdChecks, getProjectsWithProducts, getWorkspace } from "@/lib/data";
import { getPromoEventViews, getToday } from "@/lib/data/launch";
import { getCurrentMember } from "./current-member";
import { ProjectSwitcher } from "./project-switcher";
import { WorkspaceName } from "./workspace-name";

// 알림 기능(읽음 기록)이 아직 없어서, 홈 할 일 카드에서 처리할 것의 수를 보여 주는 바로가기로 쓴다.
// 이동할 곳은 홈 캘린더의 할 일 카드 (app/(internal)/(dashboard)/_home/ids.ts의 HOME_TODO_ID)
const TODO_HREF = "/#home-todo";

export async function TopBar() {
  const [workspace, lines, me, pending, events, today] = await Promise.all([
    getWorkspace(),
    getProjectsWithProducts(),
    getCurrentMember(),
    getAdChecks({ status: "pending" }),
    getPromoEventViews(),
    getToday(),
  ]);
  // 처리할 것 = 검토를 기다리는 문구 + 끝내지 않고 지난 준비 마감
  const overdue = events.flatMap((e) => e.milestones).filter((m) => !m.done && m.dueDate < today).length;
  const count = pending.length + overdue;
  const bellLabel = count > 0 ? `확인할 일 ${count}건: 문구 검토 대기 ${pending.length}건, 지난 마감 ${overdue}건` : "확인할 일 없음";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border px-6">
      <nav aria-label="워크스페이스와 프로젝트" className="flex min-w-0 items-center gap-2 text-sm">
        <WorkspaceName fallback={workspace.name} />
        <span aria-hidden className="text-muted-foreground/60">
          /
        </span>
        <ProjectSwitcher base={lines} />
      </nav>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={TODO_HREF}
          aria-label={bellLabel}
          title={bellLabel}
          className="relative inline-flex size-10 items-center justify-center rounded-full border border-border bg-card text-foreground hover:bg-muted"
        >
          <Bell aria-hidden className="size-[18px]" />
          {count > 0 && <span aria-hidden className="absolute top-2 right-2.5 size-2 rounded-full bg-status-rejected ring-2 ring-card" />}
        </Link>
        <Link
          href="/settings"
          aria-label={`${me.name} (${me.role === "owner" ? "팀장" : "팀원"}) · 설정`}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card py-1 pr-3.5 pl-1 text-foreground hover:bg-muted"
        >
          <span aria-hidden className="inline-flex size-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
            {me.name.slice(0, 1)}
          </span>
          <span aria-hidden className="flex flex-col leading-tight">
            <span className="text-[13px] font-medium">{me.name}</span>
            <span className="text-[11px] text-muted-foreground">{me.role === "owner" ? "팀장" : "팀원"}</span>
          </span>
        </Link>
      </div>
    </header>
  );
}
