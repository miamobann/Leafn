import Link from "next/link";
import { getCurrentMember } from "@/components/layout/current-member";
import { getAdChecks, getProducts, getProjectsWithProducts } from "@/lib/data";
import { getHomeProgress } from "@/lib/data/home";
import { getPlatformViews, getPromoEventViews } from "@/lib/data/launch";
import { getMyTabs, STALE_REVIEW_DAYS } from "@/lib/data/submissions";
import { dDay } from "@/lib/format";
import { OWN_PRODUCT_LINE } from "@/lib/own-products";
import { CopyQueue } from "./_home/copy-queue";
import { HomeCalendar } from "./_home/home-calendar";
import { HomeHeader, type HomeNextEvent, type HomeTodoSummary } from "./_home/home-header";
import { HOME_TODO_ID } from "./_home/ids";
import { ProjectBoard } from "./_home/project-board";
import { ScrollButtons } from "./_home/scroll-buttons";

// 할 일 칸이 세는 마감 범위 (오늘부터 며칠). 캘린더 할 일 카드와 같다 (_home/calendar-todo.tsx)
const TODO_WINDOW_DAYS = 14;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const USAGE = { detail_page: "상세페이지", sns: "SNS", banner: "배너", survey_result: "설문 결과", notify_button: "알림 버튼" };

const addDays = (date: string, days: number) => new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10);

/** "2026-10-26" → "10월 26일 월요일" (날짜 문자열만으로 계산한다) */
function dateLabel(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return `${m}월 ${d}일 ${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}요일`;
}

/**
 * 홈 (2026-10-26 홈 새 디자인): 인사와 요약 두 칸 → 프로젝트 진행 현황 + 문구 검토 대기 → 캘린더 + 할 일.
 * 탭별 요약 카드 4개는 뺐다. 현황판은 판매 중 제품 × 4칸의 시안 상태와 데이터 준비다 (서버 데이터 연동 작업 지침서 4번 A안)
 */
export default async function HomePage() {
  const [pending, lines, events, platforms, my, me, ownProducts] = await Promise.all([
    getAdChecks({ status: "pending" }),
    getProjectsWithProducts(),
    getPromoEventViews(),
    getPlatformViews(),
    getMyTabs(),
    getCurrentMember(),
    getProducts({ kind: "own" }),
  ]);
  const progress = await getHomeProgress(lines.map((line) => line.id));
  const { today } = progress;
  // 결재가 한 사람에게 몰려 늦어지는 것을 홈에서 보이게 한다 (docs/team-approval-ai-analysis.md 8장 보완 4). 결재함은 팀장만 보므로 알림도 팀장에게만
  const staleReviews = my.role === "owner" ? progress.staleReviews : 0;

  // 요약 칸: 끝내지 않은 준비 마감(지난 것 포함) 중 2주 안, 가장 이른 것이 가장 급한 일
  const until = addDays(today, TODO_WINDOW_DAYS);
  const due = events
    .flatMap((e) => e.milestones)
    .filter((m) => !m.done && m.dueDate <= until)
    .toSorted((a, b) => a.dueDate.localeCompare(b.dueDate));
  const urgent = due[0];
  const urgentWhen = urgent ? dDay(urgent.dueDate, today) : "";
  const todo: HomeTodoSummary = {
    count: due.length,
    urgent: urgent
      ? { label: urgent.label, when: urgent.dueDate < today ? `지남 ${urgentWhen.slice(2)}일` : urgentWhen, overdue: urgent.dueDate < today }
      : null,
  };
  const nextEvent = progress.nextEvent;
  const next: HomeNextEvent = nextEvent
    ? { id: nextEvent.id, dDay: dDay(nextEvent.startDate, today), title: nextEvent.title, date: nextEvent.startDate.slice(5) }
    : null;

  // 문구 검토 대기 카드: 어느 제품(없으면 용도)의 문구인지
  const productName = new Map(ownProducts.map((p) => [p.id, p.name.startsWith(OWN_PRODUCT_LINE) ? p.name.slice(OWN_PRODUCT_LINE.length).trim() : p.name]));
  const queue = pending.map((a) => ({
    id: a.id,
    text: a.input_text,
    lang: a.input_lang,
    where: (a.product_id ? productName.get(a.product_id) : undefined) ?? (a.usage ? USAGE[a.usage] : null),
    risk: a.overall_risk ?? null,
    createdAt: a.created_at,
  }));

  return (
    <div className="flex flex-col gap-5">
      <HomeHeader
        name={me.name}
        dateLabel={dateLabel(today)}
        todo={todo}
        next={next}
        todoHref={`#${HOME_TODO_ID}`}
        notice={
          staleReviews > 0 && (
            <p role="note" className="text-sm">
              <Link href="/approvals" className="font-semibold text-status-pending underline-offset-4 hover:underline">
                {STALE_REVIEW_DAYS}일 넘게 결재를 기다리는 시안 {staleReviews}건 → 결재함
              </Link>
            </p>
          )
        }
      />
      <div className="flex flex-wrap items-stretch gap-5">
        <ProjectBoard
          lines={lines}
          grids={progress.grids}
          readiness={progress.readiness}
          waiting={progress.waiting}
          staleDays={STALE_REVIEW_DAYS}
          next={next}
        />
        <CopyQueue items={queue} />
      </div>
      <HomeCalendar events={events} platformKeys={platforms.map((p) => p.key)} today={today} next={next} />
      <ScrollButtons />
    </div>
  );
}
