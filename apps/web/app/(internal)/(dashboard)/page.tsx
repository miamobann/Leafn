import { PageHeader } from "@/components/layout/page-header";
import { getAdChecks, getBoardProjects } from "@/lib/data";
import { getPlatformViews, getPromoEventViews, getToday } from "@/lib/data/launch";
import { isSupabaseConfigured } from "@/lib/data/workspace";
import { HomeCalendar } from "./_home/home-calendar";
import { ProjectBoard, ProjectProgress, StageDetail } from "./_home/project-board";
import { ScrollButtons } from "./_home/scroll-buttons";
import { SummaryCards } from "./_home/summary-cards";
import { getTabSummaries } from "./_home/tab-summary";

export default async function HomePage() {
  const [pending, projects, calendarEvents, platforms, today, summaries] = await Promise.all([
    getAdChecks({ status: "pending" }),
    getBoardProjects(),
    getPromoEventViews(),
    getPlatformViews(),
    getToday(),
    getTabSummaries(),
  ]);

  return (
    <ProjectProgress>
      {/* 첫 화면: 위쪽 바(3.5rem)와 본문 위 여백(2rem)을 뺀 높이. 벽돌 상세는 늘 이 아래에서 시작한다 */}
      <div className="min-h-[calc(100vh-5.5rem)]">
        {/* 다음 행사와 승인 대기 문구는 캘린더 패널(다음 행사 · 문구 검토 대기)에서 본다 */}
        <PageHeader title="홈" description="이번 주 할 일과 프로젝트 진행" featureId="J" />
        <SummaryCards items={summaries} />
        {isSupabaseConfigured() && <p className="my-4 text-sm text-muted-foreground">업무 단계 현황과 활동 기록은 저장 구조 준비 중입니다. 프로젝트·제품은 상단 메뉴에서 확인할 수 있습니다.</p>}
        <ProjectBoard projects={projects} />
        <HomeCalendar
          events={calendarEvents}
          platformKeys={platforms.map((p) => p.key)}
          today={today}
          pending={pending.map((a) => ({ id: a.id, text: a.input_text, eventId: a.promo_event_id ?? null }))}
          projects={projects}
        />
      </div>
      <StageDetail projects={projects} />
      <ScrollButtons />
    </ProjectProgress>
  );
}
