import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { getAdChecks, getBoardProjects } from "@/lib/data";
import { getPlatformViews, getPromoEventViews, getToday } from "@/lib/data/launch";
import { HomeCalendar } from "./_home/home-calendar";
import { ProjectBoard, ProjectProgress, StageDetail } from "./_home/project-board";
import { ScrollButtons } from "./_home/scroll-buttons";

export default async function HomePage() {
  const [pending, projects, calendarEvents, platforms, today] = await Promise.all([
    getAdChecks({ status: "pending" }),
    getBoardProjects(),
    getPromoEventViews(),
    getPlatformViews(),
    getToday(),
  ]);

  return (
    <ProjectProgress>
      {/* 첫 화면: 위쪽 바(3.5rem)와 본문 위 여백(2rem)을 뺀 높이. 벽돌 상세는 늘 이 아래에서 시작한다 */}
      <div className="min-h-[calc(100vh-5.5rem)]">
        <div className="flex items-start justify-between gap-4">
          <PageHeader title="홈" description="이번 주 할 일과 프로젝트 진행" featureId="J" />
          {/* 다음 행사는 캘린더 패널로 옮기고, 승인 대기 문구 수만 제목 줄 오른쪽 빈 자리에 둔다 */}
          <Link
            href="/ad-check/history"
            className="flex shrink-0 items-center gap-4 rounded-xl border border-status-pending/40 bg-status-pending/10 px-4 py-2.5 hover:bg-status-pending/15"
          >
            <span>
              <span className="block text-xs text-muted-foreground">승인 대기 문구</span>
              <span className="block text-2xl leading-tight font-semibold">{pending.length}건</span>
            </span>
            <span className="text-sm text-muted-foreground">검토 이력 →</span>
          </Link>
        </div>
        <ProjectBoard projects={projects} />
        <HomeCalendar
          events={calendarEvents}
          platformKeys={platforms.map((p) => p.key)}
          today={today}
          pending={pending.map((a) => ({ id: a.id, text: a.input_text, eventId: a.promo_event_id ?? null }))}
        />
      </div>
      <StageDetail projects={projects} />
      <ScrollButtons />
    </ProjectProgress>
  );
}
