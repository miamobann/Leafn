"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { TrendSnapshot } from "@/lib/schemas/trend";
import { DYNAMICS_TOP_N, entryWindow, rankingDynamics } from "@/app/(internal)/(dashboard)/market/_lib/market";
import { StackedBarChart, TrendLineChart } from "@/app/(internal)/(dashboard)/market/_components/charts";
import { ToggleGroup } from "@/app/(internal)/(dashboard)/market/_components/toggle-group";

// 랭킹 역동성 비교 기준
const LAG_OPTIONS = ["지난주", "4주 전"] as const;
type LagOption = (typeof LAG_OPTIONS)[number];
const LAG_WEEKS: Record<LagOption, number> = { "지난주": 1, "4주 전": 4 };

// 자리를 지킨 제품은 중간 회색, 신규 진입은 가장 진한 색 (라이트·다크 모두 명도 차가 크다)
const STACK_SERIES = [
  { key: "retained", label: "고인물 (자리 유지)", color: "var(--chart-2)" },
  { key: "entered", label: "뉴페이스 (신규 진입)", color: "var(--primary)" },
];

/** 랭킹 역동성 (시장 트렌드 화면과 원페이지 시장 개관이 같이 쓴다). snapshots는 한 플랫폼 것만 넘긴다 */
export function RankingDynamics({ snapshots, category, platformLabel = "楽天ランキング" }: { snapshots: TrendSnapshot[]; category: string; platformLabel?: string }) {
  const [lag, setLag] = useState<LagOption>("지난주");

  const dynamics = rankingDynamics(snapshots, category, LAG_WEEKS[lag]);
  const measured = dynamics.filter((d) => d.churn !== null);
  const entry = entryWindow(dynamics);
  const last = measured.at(-1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          {entry.avgChurn === null ? (
            <span className="text-muted-foreground">비교할 주가 부족해요</span>
          ) : (
            <>
              평균 교체율 <span className="text-2xl font-semibold">{entry.avgChurn}%</span>
              <Badge className="ml-2" variant={entry.label === "열림" ? "default" : entry.label === "고착" ? "outline" : "secondary"}>
                진입 여지 {entry.label}
              </Badge>
              {last && (
                <span className="ml-3 text-muted-foreground">
                  이번 주 신규 {last.entered}개 ({last.churn}%) · 자리 지킨 제품 평균 {last.avgShift}계단 이동
                </span>
              )}
            </>
          )}
        </p>
        <ToggleGroup label="비교 기준" options={LAG_OPTIONS} value={lag} onChange={setLag} />
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">Top {DYNAMICS_TOP_N} 구성 (제품 수)</p>
        <StackedBarChart data={dynamics.map((d) => ({ week: d.week, retained: d.retained, entered: d.entered }))} series={STACK_SERIES} unit="개" height={220} />
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">자리 지킨 제품의 평균 순위 변동 (계단)</p>
        <TrendLineChart
          data={dynamics.map((d) => ({ week: d.week, avgShift: d.avgShift }))}
          series={[{ key: "avgShift", label: "평균 순위 변동", color: "var(--chart-4)", emphasis: true }]}
          height={140}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        매주 {platformLabel} Top {DYNAMICS_TOP_N}을 {lag} Top {DYNAMICS_TOP_N}과 비교 (제품은 브랜드·상품명으로 맞춤) · 교체율 = 신규 진입 ÷ {DYNAMICS_TOP_N} · 처음 {LAG_WEEKS[lag]}주는 비교 대상이 없어 비워 둠 ·
        진입 여지 = 평균 교체율 20% 이상 열림, 10% 미만 고착 (참고 기준) · 순위 변동이 크면 상위권도 자리가 흔들리는 시장 (샘플)
      </p>
    </div>
  );
}
