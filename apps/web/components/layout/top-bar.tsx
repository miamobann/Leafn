import { isSupabaseConfigured } from "@/lib/data/workspace";
// 상단 헤더: 워크스페이스 / 프로젝트(제품군) 선택. 워크스페이스 → 프로젝트 → 제품 구조 (2026-10-24 총괄 결정)
import { getProjectsWithProducts, getWorkspace } from "@/lib/data";
import { ProjectSwitcher } from "./project-switcher";
import { WorkspaceName } from "./workspace-name";

export async function TopBar() {
  const [workspace, lines] = await Promise.all([getWorkspace(), getProjectsWithProducts()]);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border px-6">
      <nav aria-label="워크스페이스와 프로젝트" className="flex min-w-0 items-center gap-2 text-sm">
        <WorkspaceName fallback={workspace.name} />
        <span aria-hidden className="text-muted-foreground/60">
          /
        </span>
        <ProjectSwitcher base={lines} />
      </nav>
      <span className="shrink-0 rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
        {isSupabaseConfigured() ? "실제 팀 데이터 · 미연결 기능 별도 안내" : "샘플 데이터 · 저장되지 않음"}
      </span>
    </header>
  );
}
