import Link from "next/link";
import { ViewStateGate } from "@/components/common/view-state";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdChecks, getBoardProjects, getPromoEvents } from "@/lib/data";
import { dDay } from "@/lib/format";
import { ProjectBoard, ProjectProgress, StageDetail } from "./_home/project-board";
import { ScrollButtons } from "./_home/scroll-buttons";

export default async function HomePage() {
  const [pending, events, projects] = await Promise.all([
    getAdChecks({ status: "pending" }),
    getPromoEvents(),
    getBoardProjects(),
  ]);
  const next = events[0];
  const stats = [
    { label: "승인 대기 문구", value: `${pending.length}건` },
    { label: "다음 행사", value: next ? `${dDay(next.start_date)}` : "—" },
  ];

  return (
    <ProjectProgress>
      {/* 첫 화면: 위쪽 바(3.5rem)와 본문 위 여백(2rem)을 뺀 높이. 벽돌 상세는 늘 이 아래에서 시작한다 */}
      <div className="min-h-[calc(100vh-5.5rem)]">
        <PageHeader title="홈" description="이번 주 할 일과 프로젝트 진행" featureId="J" />
        {/* 템플릿의 숫자 카드 줄은 4칸 고정이라, 홈에서만 2칸으로 넓히려고 여기서 직접 그린다 */}
        <div className="grid grid-cols-2 gap-4">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardContent>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-2xl font-semibold">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <ProjectBoard projects={projects} />
        {/* 최근 활동은 사이드바 맨 아래로 옮겼다. 템플릿의 상자 줄은 2칸 고정이라, 할 일 하나를 한 줄 전체로 넓히려고 여기서 직접 그린다 */}
        <ViewStateGate>
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>할 일</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {pending.map((a) => (
                  <li key={a.id}>
                    <Link href={`/ad-check/${a.id}`} className="hover:underline">
                      광고 문구 검토 대기 · {a.input_text}
                    </Link>
                  </li>
                ))}
                {events.slice(0, 2).map((e) => (
                  <li key={e.id}>
                    {e.title} 준비 마감 {dDay(e.prep_due_date)}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </ViewStateGate>
      </div>
      <StageDetail projects={projects} />
      <ScrollButtons />
    </ProjectProgress>
  );
}
