import Link from "next/link";
import { ProgressGridCard } from "@/components/common/progress-grid";
import { PageHeader } from "@/components/layout/page-header";
import { getAdChecks, getProjectsWithProducts } from "@/lib/data";
import { getPlatformViews, getPromoEventViews, getToday } from "@/lib/data/launch";
import { getApprovalInbox, STALE_REVIEW_DAYS } from "@/lib/data/submissions";
import { isSupabaseConfigured } from "@/lib/data/workspace";
import { HomeCalendar } from "./_home/home-calendar";
import { ScrollButtons } from "./_home/scroll-buttons";
import { SummaryCards } from "./_home/summary-cards";
import { getTabSummaries } from "./_home/tab-summary";

export default async function HomePage() {
  const [pending, projects, calendarEvents, platforms, today, summaries, inbox] = await Promise.all([
    getAdChecks({ status: "pending" }),
    getProjectsWithProducts(),
    getPromoEventViews(),
    getPlatformViews(),
    getToday(),
    getTabSummaries(),
    getApprovalInbox({ recentLimit: 0 }),
  ]);
  // 결재가 한 사람에게 몰려 늦어지는 것을 홈에서 보이게 한다 (docs/team-approval-ai-analysis.md 8장 보완 4)
  const staleReviews = inbox.pending.filter((r) => r.waitingDays > STALE_REVIEW_DAYS).length;

  return (
    <>
      {/* 첫 화면: 위쪽 바(3.5rem)와 본문 위 여백(2rem)을 뺀 높이 */}
      <div className="min-h-[calc(100vh-5.5rem)]">
        {/* 다음 행사와 승인 대기 문구는 캘린더 패널(다음 행사 · 문구 검토 대기)에서 본다 */}
        <PageHeader title="홈" description="이번 주 할 일과 프로젝트 진행" featureId="J" />
        {isSupabaseConfigured() && <p className="my-4 text-sm text-muted-foreground">활동 기록은 저장 구조 준비 중입니다. 프로젝트·제품은 상단 메뉴에서 확인할 수 있습니다.</p>}
        {staleReviews > 0 && (
          <p role="note" className="mb-3 text-sm">
            <Link href="/approvals" className="font-semibold text-status-pending underline-offset-4 hover:underline">
              {STALE_REVIEW_DAYS}일 넘게 결재를 기다리는 시안 {staleReviews}건 → 결재함
            </Link>
          </p>
        )}
        {/* 위 줄은 제품 × 탭 진행 표(왼쪽, 샘플 8단계 현황판을 대신함 · CLAUDE.md 10장 3단계)와 탭 요약 카드 2×2(오른쪽, 진행 표 높이에 맞춤),
            아래 줄은 캘린더가 두 열에 걸친다. 화면 폭과 상관없이 이 배치를 지킨다. 열 비율을 바꾸면 home-calendar.tsx의 패널 폭 계산도 함께 바꾼다 */}
        <div className="grid grid-cols-[minmax(0,65fr)_minmax(0,35fr)] gap-x-4 gap-y-3">
          <ProgressGridCard projects={projects.map((p) => ({ id: p.id, name: p.name }))} />
          <SummaryCards items={summaries} />
          <div className="col-span-2 min-w-0">
            <HomeCalendar
              events={calendarEvents}
              platformKeys={platforms.map((p) => p.key)}
              today={today}
              pending={pending.map((a) => ({ id: a.id, text: a.input_text, eventId: a.promo_event_id ?? null }))}
            />
          </div>
        </div>
      </div>
      <ScrollButtons />
    </>
  );
}
