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
    // 화면 폭 1800px 이상에서만 바깥 여백 12px와 둥근 틀을 둔다. 1440px 노트북에서는 틀이 표·글을 밀어내 정보량이 줄어서,
    // 그보다 좁은 화면은 꽉 채운다 (디자인 전환 2단계, 1440·1920 측정 결과)
    <div className="flex h-screen min-w-[1024px] bg-canvas min-[1800px]:p-3">
      <div className="flex min-w-0 flex-1 overflow-hidden bg-background min-[1800px]:rounded-2xl">
        <AppSidebar activity={activity} role={my.role} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto p-8">
            <SectionTabs role={my.role} />
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
