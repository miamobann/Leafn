"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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
