"use client";

// 소구점 찾기: 경쟁 TOP10의 낮은 평점 불만(일본) vs 자사 칭찬(국내)을 주제별로 비교한다 (prototype-plan P4)
import Link from "next/link";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { getAppealComparison } from "@/lib/data";
import { APPEAL_TOPICS, type AppealTopic } from "@/lib/schemas/review";

export type AppealComparison = NonNullable<Awaited<ReturnType<typeof getAppealComparison>>>;
type TopicRow = AppealComparison["topics"][number];
type ReviewItem = TopicRow["complaints"][number];

const TEXT = {
  cautionTitle: "경쟁 제품을 지목하거나 깎아내리는 문구는 쓰지 마세요",
  caution:
    "일본 광고 기준(医薬品等適正広告基準 · 他社の製品の誹謗広告の制限)에 걸릴 수 있어요. 소구점은 우리 강점을 말하는 문구 후보로만 쓰고, 효능 표현은 반드시 광고 검토를 거쳐 주세요.",
  chartTitle: "주제별 비교",
  chartNote: "왼쪽: 경쟁 1~3점 리뷰 중 그 불만이 나온 비율 · 오른쪽: 자사 국내 리뷰 중 그 칭찬이 나온 비율",
  candidatesTitle: "소구점 후보",
  noCandidate: "기준을 넘는 소구점 후보가 없어요",
  otherTitle: "후보가 아닌 주제",
  detailTitle: "근거 리뷰",
  jpComplaint: "일본 불만 (경쟁 1~3점)",
  ownPraise: "우리 강점 (국내 리뷰)",
  ownComplaint: "우리 쪽 같은 불만",
  sendToAdCheck: "광고 검토로 보내기",
  sendNote: "문구 초안은 광고 검토(TAB 3)에서 약기법 확인 후 사용해요 · 저장되지 않음",
  competitorsTitle: "비교 대상: Qoo10 랭킹 TOP10",
  sample: "샘플 데이터 · 가상 브랜드",
} as const;

const chartConfig = {
  complaint: { label: "경쟁 불만", color: "#eb6834" },
  praise: { label: "자사 칭찬", color: "#2a78d6" },
} satisfies ChartConfig;

const pct = (share: number) => `${Math.round(share * 100)}%`;

function notCandidateReason(t: TopicRow, rule: AppealComparison["rule"]) {
  if (t.complaints.length < rule.minComplaints) return "경쟁 불만이 적어요";
  if (t.praises.length < rule.minPraises) return "우리 칭찬이 부족해요";
  return "우리 쪽에도 같은 불만이 많아요";
}

function ReviewList({ reviews, productName }: { reviews: ReviewItem[]; productName?: (id: string) => string }) {
  if (reviews.length === 0) return <p className="text-sm text-muted-foreground">해당 리뷰가 없어요</p>;
  return (
    <ul className="space-y-2">
      {reviews.map((r) => (
        <li key={r.id} className="rounded-md border p-3 text-sm">
          <p className="mb-1 text-xs text-muted-foreground">
            ★ {r.rating}
            {productName && ` · ${productName(r.product_id)}`}
            {r.reviewer_attrs?.skin_type && ` · ${r.reviewer_attrs.skin_type}`}
            {r.reviewer_attrs?.age_group && ` · ${r.reviewer_attrs.age_group}`}
          </p>
          <p lang={r.lang}>{r.body}</p>
          {r.body_ko && <p className="mt-1 text-muted-foreground">{r.body_ko}</p>}
        </li>
      ))}
    </ul>
  );
}

export function AppealCompare({ comparisons }: { comparisons: AppealComparison[] }) {
  const [productId, setProductId] = useState(comparisons[0]?.own.id);
  const data = comparisons.find((c) => c.own.id === productId) ?? comparisons[0];
  const [selected, setSelected] = useState<AppealTopic | null>(null);
  if (!data) return null;

  const candidates = data.topics.filter((t) => t.isCandidate);
  const others = data.topics.filter((t) => !t.isCandidate);
  const current = data.topics.find((t) => t.topic === selected) ?? candidates[0] ?? data.topics[0];
  const productName = (id: string) => {
    const p = data.competitors.find((c) => c.id === id);
    return p ? `${p.rank}위 ${p.brand} ${p.name}` : id;
  };

  const chartRows = data.topics.map((t) => ({
    topic: t.topic,
    name: `${t.isCandidate ? "★ " : ""}${APPEAL_TOPICS[t.topic].name}`,
    complaint: -Math.round(t.complaintShare * 100),
    praise: Math.round(t.praiseShare * 100),
    complaintCount: t.complaints.length,
    praiseCount: t.praises.length,
  }));
  const maxShare = Math.max(10, ...chartRows.map((r) => Math.max(-r.complaint, r.praise)));
  const domainMax = Math.ceil(maxShare / 10) * 10;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {comparisons.map((c) => (
          <Button
            key={c.own.id}
            variant={c.own.id === data.own.id ? "default" : "outline"}
            size="sm"
            aria-pressed={c.own.id === data.own.id}
            onClick={() => {
              setProductId(c.own.id);
              setSelected(null);
            }}
          >
            {c.own.name}
          </Button>
        ))}
        <span className="ml-2 text-sm text-muted-foreground">
          vs Qoo10 <span lang="ja">{data.own.category}</span> TOP{data.competitors.length} · {data.maxRating}점 이하 리뷰{" "}
          {data.lowReviewCount}건 / 자사 국내 리뷰 {data.ownReviewCount}건
        </span>
        <Badge variant="secondary" className="ml-auto">
          {TEXT.sample}
        </Badge>
      </div>

      <Alert>
        <AlertTitle>⚠ {TEXT.cautionTitle}</AlertTitle>
        <AlertDescription>{TEXT.caution}</AlertDescription>
      </Alert>

      <div className="grid grid-cols-[3fr_2fr] gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{TEXT.chartTitle}</CardTitle>
            <p className="text-xs text-muted-foreground">{TEXT.chartNote}</p>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
              <BarChart data={chartRows} layout="vertical" stackOffset="sign" margin={{ left: 8, right: 16 }}>
                <CartesianGrid horizontal={false} />
                <XAxis
                  type="number"
                  domain={[-domainMax, domainMax]}
                  tickFormatter={(v: number) => `${Math.abs(v)}%`}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis type="category" dataKey="name" width={84} tickLine={false} axisLine={false} />
                <ReferenceLine x={0} stroke="var(--border)" />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      formatter={(value, name, item) => {
                        const row = item.payload as (typeof chartRows)[number];
                        const isComplaint = name === "complaint";
                        return (
                          <span>
                            {isComplaint ? "경쟁 불만" : "자사 칭찬"} {Math.abs(Number(value))}% (
                            {isComplaint ? row.complaintCount : row.praiseCount}건)
                          </span>
                        );
                      }}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar
                  dataKey="complaint"
                  stackId="a"
                  fill="var(--color-complaint)"
                  radius={[4, 0, 0, 4]}
                  maxBarSize={20}
                  className="cursor-pointer"
                  onClick={(entry) => setSelected((entry.payload as (typeof chartRows)[number]).topic)}
                />
                <Bar
                  dataKey="praise"
                  stackId="a"
                  fill="var(--color-praise)"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={20}
                  className="cursor-pointer"
                  onClick={(entry) => setSelected((entry.payload as (typeof chartRows)[number]).topic)}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{TEXT.competitorsTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-1 text-sm">
              {data.competitors.map((p) => (
                <li key={p.id} className="grid grid-cols-[2rem_1fr_auto] gap-2">
                  <span className="text-muted-foreground">{p.rank}위</span>
                  <span className="truncate">
                    {p.brand} <span lang="ja">{p.name}</span>
                  </span>
                  <span className="text-muted-foreground">낮은 평점 {p.lowReviewCount}건</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{TEXT.candidatesTitle}</CardTitle>
          <p className="text-xs text-muted-foreground">
            기준: 경쟁 불만 {data.rule.minComplaints}건 이상 · 우리 칭찬 {data.rule.minPraises}건 이상 · 우리 칭찬이 우리 쪽 같은
            불만의 {data.rule.praiseToComplaintRatio}배 이상
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {candidates.length === 0 && <p className="text-sm text-muted-foreground">{TEXT.noCandidate}</p>}
          <div className="grid grid-cols-3 gap-3">
            {candidates.map((t) => {
              const meta = APPEAL_TOPICS[t.topic];
              const active = current?.topic === t.topic;
              return (
                <button
                  key={t.topic}
                  type="button"
                  onClick={() => setSelected(t.topic)}
                  aria-pressed={active}
                  className={`rounded-lg border p-4 text-left text-sm transition-colors hover:bg-muted ${active ? "border-foreground" : ""}`}
                >
                  <p className="mb-2 font-semibold">★ {meta.name}</p>
                  <p>
                    <span className="text-muted-foreground">일본 불만 </span>
                    <span lang="ja">{meta.negative.ja}</span> ({meta.negative.ko})
                  </p>
                  <p className="text-xs text-muted-foreground">
                    TOP{data.competitors.length} 중 {t.complaintProductCount}개 제품 · {t.complaints.length}건 ({pct(t.complaintShare)})
                  </p>
                  <p className="mt-2">
                    <span className="text-muted-foreground">우리 강점 </span>
                    {meta.positive.ko}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    국내 {t.praises.length}건 ({pct(t.praiseShare)}) · 우리 쪽 같은 불만 {t.ownComplaints.length}건
                  </p>
                </button>
              );
            })}
          </div>
          {others.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {TEXT.otherTitle}:{" "}
              {others.map((t, i) => (
                <span key={t.topic}>
                  {i > 0 && " · "}
                  <button type="button" className="underline-offset-4 hover:underline" onClick={() => setSelected(t.topic)}>
                    {APPEAL_TOPICS[t.topic].name}
                  </button>{" "}
                  ({notCandidateReason(t, data.rule)})
                </span>
              ))}
            </p>
          )}
        </CardContent>
      </Card>

      {current && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              {TEXT.detailTitle} · {current.isCandidate ? "★ " : ""}
              {APPEAL_TOPICS[current.topic].name}
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{TEXT.sendNote}</span>
              {current.isCandidate ? (
                <Link href="/ad-check" className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
                  {TEXT.sendToAdCheck}
                </Link>
              ) : (
                <Button size="sm" disabled>
                  {TEXT.sendToAdCheck}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <section>
              <h3 className="mb-2 text-sm font-semibold">
                {TEXT.jpComplaint} · <span lang="ja">{APPEAL_TOPICS[current.topic].negative.ja}</span> {current.complaints.length}건
              </h3>
              <ReviewList reviews={current.complaints} productName={productName} />
            </section>
            <section>
              <h3 className="mb-2 text-sm font-semibold">
                {TEXT.ownPraise} · {APPEAL_TOPICS[current.topic].positive.ko} {current.praises.length}건
              </h3>
              <ReviewList reviews={current.praises} />
              {current.ownComplaints.length > 0 && (
                <>
                  <h3 className="mt-4 mb-2 text-sm font-semibold">
                    {TEXT.ownComplaint} · {APPEAL_TOPICS[current.topic].negative.ko} {current.ownComplaints.length}건
                  </h3>
                  <ReviewList reviews={current.ownComplaints} />
                </>
              )}
            </section>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
