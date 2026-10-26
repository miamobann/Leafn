import { AppSidebar } from "@/components/layout/app-sidebar";
import { SectionTabs } from "@/components/layout/section-tabs";
import { TopBar } from "@/components/layout/top-bar";
import { getActivity } from "@/lib/data";
import { getMyTabs } from "@/lib/data/submissions";

// 사이드바 맨 아래에 보여 줄 최근 활동 개수
const RECENT_ACTIVITY_COUNT = 3;

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [rawActivity, my] = await Promise.all([getActivity(), getMyTabs()]);
  const activity = rawActivity
    .toSorted((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, RECENT_ACTIVITY_COUNT)
    .map(({ id, actor_name, action, created_at }) => ({ id, actor_name, action, created_at }));

  return (
    <div className="flex h-screen min-w-[1024px]">
      <AppSidebar activity={activity} role={my.role} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-8">
          <SectionTabs role={my.role} />
          {children}
        </main>
      </div>
    </div>
  );
}
