import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { OverviewTemplate } from "@/components/templates";
import { Card, CardContent } from "@/components/ui/card";
import { getActivity, getAdChecks, getProjects, getPromoEvents } from "@/lib/data";
import { dDay, formatDate } from "@/lib/format";
import { ProjectBoard, ProjectProgress, StageDetail } from "./_home/project-board";

export default async function HomePage() {
  const [pending, events, activity, projects] = await Promise.all([
    getAdChecks({ status: "pending" }),
    getPromoEvents(),
    getActivity(),
    getProjects(),
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
        <PageHeader title="홈" description="이번 주 할 일과 팀 활동" featureId="J" />
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
        <OverviewTemplate
          stats={[]}
          sections={[
            {
              title: "할 일",
              items: [
                ...pending.map((a) => (
                  <Link key={a.id} href={`/ad-check/${a.id}`} className="hover:underline">
                    광고 문구 검토 대기 · {a.input_text}
                  </Link>
                )),
                ...events.slice(0, 2).map((e) => (
                  <span key={e.id}>
                    {e.title} 준비 마감 {dDay(e.prep_due_date)}
                  </span>
                )),
              ],
            },
            {
              title: "최근 활동",
              items: activity.map((a) => (
                <span key={a.id}>
                  {a.actor_name} · {a.action} <span className="text-muted-foreground">{formatDate(a.created_at)}</span>
                </span>
              )),
            },
          ]}
        />
      </div>
      <StageDetail projects={projects} />
    </ProjectProgress>
  );
}
