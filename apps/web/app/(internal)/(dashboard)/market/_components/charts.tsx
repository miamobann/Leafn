"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";

// 팀 테마(globals.css)의 무채색 차트 색을 쓴다. 색만으로 구분하지 않도록 선 모양(실선·점선)과 범례·라벨을 같이 쓴다.
const AXIS = { fontSize: 11, fill: "var(--muted-foreground)" };
const TOOLTIP_STYLE = {
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  fontSize: 12,
};

export type LineSeries = { key: string; label: string; color: string; dash?: string; emphasis?: boolean };

export function TrendLineChart({
  data,
  series,
  unit = "",
  reversed = false,
  domain,
  height = 260,
  onPointClick,
}: {
  data: Record<string, string | number | null>[];
  series: LineSeries[];
  unit?: string;
  /** 순위처럼 작은 값이 위로 가야 할 때 */
  reversed?: boolean;
  domain?: [number, number];
  height?: number;
  /** 주(x축 한 칸)를 누르면 그 데이터의 순서를 넘긴다 */
  onPointClick?: (index: number) => void;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={data}
        margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
        onClick={onPointClick ? (state) => state.activeTooltipIndex != null && onPointClick(Number(state.activeTooltipIndex)) : undefined}
        className={onPointClick ? "cursor-pointer" : undefined}
      >
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="week" tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
        <YAxis
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          width={44}
          reversed={reversed}
          domain={domain ?? ["auto", "auto"]}
          allowDecimals={false}
          tickFormatter={(v: number) => `${v}${unit}`}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => `${v}${unit}`} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={s.emphasis ? 3 : 2}
            strokeDasharray={s.dash}
            dot={{ r: s.emphasis ? 3 : 2, fill: s.color }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export type BarItem = { id: string; label: string; value: number; highlight?: boolean; selected?: boolean };

/** 가로 막대. highlight = 자사(진한 색), selected = 선택 표시(테두리) */
export function HorizontalBarChart({
  items,
  unit = "",
  onSelect,
  labelWidth = 120,
}: {
  items: BarItem[];
  unit?: string;
  onSelect?: (id: string) => void;
  labelWidth?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={items.length * 30 + 16}>
      <BarChart data={items} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 0 }} barCategoryGap={6}>
        <XAxis type="number" hide domain={[0, "dataMax"]} />
        <YAxis type="category" dataKey="label" tick={AXIS} tickLine={false} axisLine={false} width={labelWidth} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)" }} formatter={(v) => `${v}${unit}`} />
        <Bar
          dataKey="value"
          radius={[0, 4, 4, 0]}
          isAnimationActive={false}
          onClick={onSelect ? (_d, index) => onSelect(items[index].id) : undefined}
          className={onSelect ? "cursor-pointer" : undefined}
        >
          {items.map((it) => (
            <Cell
              key={it.id}
              fill={it.highlight ? "var(--primary)" : "var(--chart-2)"}
              stroke={it.selected ? "var(--foreground)" : "none"}
              strokeWidth={it.selected ? 2 : 0}
            />
          ))}
          <LabelList dataKey="value" position="right" style={AXIS} formatter={(v) => `${v}${unit}`} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export type StackSeries = { key: string; label: string; color: string };

/**
 * 세로 누적 막대 (주별 구성 비교). 아래 → 위 순서로 series를 쌓는다.
 * 조각 사이는 카드 색 2px로 띄우고, 맨 위 조각만 끝을 둥글게 한다
 */
export function StackedBarChart({
  data,
  series,
  unit = "",
  height = 240,
}: {
  data: Record<string, string | number | null>[];
  series: StackSeries[];
  unit?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }} barCategoryGap="20%">
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="week" tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} allowDecimals={false} tickFormatter={(v: number) => `${v}${unit}`} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)" }} formatter={(v) => (v === null ? "—" : `${v}${unit}`)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            stackId="stack"
            fill={s.color}
            stroke="var(--card)"
            strokeWidth={2}
            radius={i === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export type PriceDot = { id: string; label: string; x: number; y: number; promo: string | null };

/**
 * 가격 포지셔닝 맵: X = 판매가, Y = ml당 실질 가격. 가운데 점선 = 각 축의 중앙값 (네 칸으로 나눠 읽는다).
 * 프로모션 없음 = 회색 원, 프로모션 진행 중 = 파랑 세모, 자사 = 진한 마름모 (색과 모양을 같이 바꿔 색만으로 구분하지 않는다)
 */
export function PriceMapChart({
  plain,
  promo,
  own,
  medianX,
  medianY,
  onSelect,
  height = 340,
}: {
  plain: PriceDot[];
  promo: PriceDot[];
  own: PriceDot[];
  medianX: number | null;
  medianY: number | null;
  onSelect?: (id: string) => void;
  height?: number;
}) {
  const click = (d: unknown) => {
    const id = (d as { payload?: { id?: string } }).payload?.id;
    if (id && onSelect) onSelect(id);
  };
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 16, right: 24, bottom: 8, left: 8 }}>
        <CartesianGrid stroke="var(--border)" />
        <XAxis type="number" dataKey="x" name="판매가" tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--border)" }} domain={["auto", "auto"]} tickFormatter={(v: number) => `¥${v.toLocaleString("ja-JP")}`} />
        <YAxis type="number" dataKey="y" name="ml당 실질 가격" tick={AXIS} tickLine={false} axisLine={false} width={56} domain={["auto", "auto"]} tickFormatter={(v: number) => `${v}円`} />
        {medianX !== null && <ReferenceLine x={medianX} stroke="var(--muted-foreground)" strokeDasharray="4 3" label={{ value: "판매가 중앙값", position: "insideTopRight", fontSize: 11, fill: "var(--muted-foreground)" }} />}
        {medianY !== null && <ReferenceLine y={medianY} stroke="var(--muted-foreground)" strokeDasharray="4 3" label={{ value: "ml당 중앙값", position: "insideBottomRight", fontSize: 11, fill: "var(--muted-foreground)" }} />}
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            const dot = active ? (payload?.[0]?.payload as PriceDot | undefined) : undefined;
            if (!dot) return null;
            return (
              <div style={TOOLTIP_STYLE} className="px-2 py-1">
                <p className="font-medium">{dot.label}</p>
                <p>
                  판매가 ¥{dot.x.toLocaleString("ja-JP")} · ml당 {dot.y}円
                </p>
                <p>{dot.promo ? `프로모션: ${dot.promo}` : "프로모션 없음"}</p>
              </div>
            );
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Scatter name="프로모션 없음" data={plain} fill="var(--chart-2)" stroke="var(--card)" strokeWidth={2} onClick={click} className="cursor-pointer" isAnimationActive={false} />
        <Scatter name="프로모션 진행 중" data={promo} fill="var(--chart-promo)" shape="triangle" stroke="var(--card)" strokeWidth={2} onClick={click} className="cursor-pointer" isAnimationActive={false} />
        <Scatter name="자사" data={own} fill="var(--primary)" shape="diamond" stroke="var(--card)" strokeWidth={2} isAnimationActive={false} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
