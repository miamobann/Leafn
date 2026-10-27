// 상단 헤더: 워크스페이스 / 프로젝트(제품군) 선택. 워크스페이스 → 프로젝트 → 제품 구조 (2026-10-24 총괄 결정)
// 오른쪽: 알림 버튼(확인할 일 패널)과 계정 (2026-10-26 홈 새 디자인. 데이터 표시 배지는 뺐다)
import Link from "next/link";
import { getProjectsWithProducts, getWorkspace } from "@/lib/data";
import { getNotifications } from "@/lib/data/notifications";
import { getCurrentMember } from "./current-member";
import { NotificationBell, type NotificationLink } from "./notification-bell";
import { ProjectSwitcher } from "./project-switcher";
import { WorkspaceName } from "./workspace-name";

// 패널 아래 바로가기. 할 일 카드는 홈 캘린더 옆 카드 (app/(internal)/(dashboard)/_home/ids.ts의 HOME_TODO_ID)
const TODO_HREF = "/#home-todo";
const LINKS: Record<"owner" | "member", NotificationLink[]> = {
  owner: [
    { label: "결재함", href: "/approvals" },
    { label: "검토 이력", href: "/ad-check/history" },
    { label: "할 일 카드", href: TODO_HREF },
  ],
  member: [
    { label: "내 시안", href: "/approvals/mine" },
    { label: "할 일 카드", href: TODO_HREF },
  ],
};

export async function TopBar() {
  // 알림을 못 읽어도 상단 바와 화면은 그대로 둔다. 실패는 패널에만 보이고(샘플로 숨기지 않음) 서버 로그에 남긴다
  const [workspace, lines, me, notices] = await Promise.all([
    getWorkspace(),
    getProjectsWithProducts(),
    getCurrentMember(),
    getNotifications().catch((error: unknown) => {
      console.error("[알림] 읽기 실패", error);
      return null;
    }),
  ]);

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
        <NotificationBell
          failed={notices === null}
          count={notices?.count ?? 0}
          todo={notices?.todo ?? []}
          results={notices?.results ?? []}
          links={LINKS[notices?.role ?? me.role]}
        />
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
