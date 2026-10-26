"use client";

import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";

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

/** 가격 맵의 점: 지름 20px 원 + 카드 색 테두리 (겹쳐도 경계가 보이게) */
const DOT_RADIUS = 10;
function dotShape(props: unknown) {
  const { cx, cy, fill } = props as { cx?: number; cy?: number; fill?: string };
  if (cx === undefined || cy === undefined) return <g />;
  return <circle cx={cx} cy={cy} r={DOT_RADIUS} fill={fill} stroke="var(--card)" strokeWidth={2} />;
}

export type PriceDot = { id: string; label: string; x: number; y: number; listPrice: number; salePrice: number | null; discountRate: number | null; promo: string | null };

/**
 * 가격 포지셔닝 맵: X = 판매가, Y = ml당 실질 가격 (보기 기준에 따라 정가 또는 할인 적용가). 가운데 점선 = 각 축의 중앙값.
 * 모두 큰 원 (2026-10-26 요청: 세모·마름모 대신 원, 작아서 보기 힘듦). 할인·프로모션 없음 = 회색, 진행 중 = 파랑, 자사 = 진한 색 · 구분은 위 범례로.
 * 축 범위는 데이터에 맞춰 좁혀서 점이 한쪽에 몰리지 않게 한다
 */
export function PriceMapChart({
  plain,
  promo,
  own,
  medianX,
  medianY,
  domainX,
  domainY,
  priceLabel,
  onSelect,
  height = 440,
}: {
  plain: PriceDot[];
  promo: PriceDot[];
  own: PriceDot[];
  medianX: number | null;
  medianY: number | null;
  domainX: [number, number] | null;
  domainY: [number, number] | null;
  /** 축 이름 (예: "판매가 (정가)") */
  priceLabel: string;
  onSelect?: (id: string) => void;
  height?: number;
}) {
  const click = (d: unknown) => {
    const id = (d as { payload?: { id?: string } }).payload?.id;
    if (id && onSelect) onSelect(id);
  };
  const yen = (v: number) => `¥${v.toLocaleString("ja-JP")}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 16, right: 24, bottom: 24, left: 8 }}>
        <CartesianGrid stroke="var(--border)" />
        <XAxis
          type="number"
          dataKey="x"
          tick={AXIS}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          domain={domainX ?? ["auto", "auto"]}
          tickFormatter={yen}
          label={{ value: priceLabel, position: "insideBottom", offset: -12, fontSize: 12, fill: "var(--muted-foreground)" }}
        />
        <YAxis
          type="number"
          dataKey="y"
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          width={64}
          domain={domainY ?? ["auto", "auto"]}
          tickFormatter={(v: number) => `${v}円`}
          label={{ value: "ml당 가격", angle: -90, position: "insideLeft", fontSize: 12, fill: "var(--muted-foreground)" }}
        />
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
                  정가 {yen(dot.listPrice)}
                  {dot.salePrice !== null && dot.discountRate !== null ? ` → 할인가 ${yen(dot.salePrice)} (${dot.discountRate}% 할인)` : " · 할인 없음"}
                </p>
                <p>
                  지금 보기: {yen(dot.x)} · ml당 {dot.y}円
                </p>
                {dot.promo && <p>프로모션: {dot.promo}</p>}
              </div>
            );
          }}
        />
        <Legend verticalAlign="top" wrapperStyle={{ fontSize: 12, paddingBottom: 8 }} />
        <Scatter name="할인·프로모션 없음" data={plain} fill="var(--chart-2)" shape={dotShape} onClick={click} className="cursor-pointer" isAnimationActive={false} />
        <Scatter name="할인·프로모션 진행 중" data={promo} fill="var(--chart-promo)" shape={dotShape} onClick={click} className="cursor-pointer" isAnimationActive={false} />
        <Scatter name="자사 (정가)" data={own} fill="var(--primary)" shape={dotShape} isAnimationActive={false} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export type ShareItem = {
  id: string;
  label: string;
  value: number;
  /** 이름 옆 옅은 글씨 (원문 표기 등) */
  hint?: string;
  /** % 옆에 붙는 수치 (예: 3/10개) */
  sub?: string;
  /** 맨 끝에 붙는 표시 (순위 변화 등) */
  extra?: ReactNode;
};

const SHARE_COLORS = ["var(--chart-cat-1)", "var(--chart-cat-2)", "var(--chart-cat-3)", "var(--chart-cat-4)", "var(--chart-cat-5)"];
const OTHER_COLOR = "var(--chart-2)";
const OTHER_ID = "__other";

/**
 * 비중 원형 그래프 (왼쪽) + 비율 순 목록 (오른쪽). 큰 순서로 5개까지 색을 주고 나머지는 회색 「기타」 조각으로 묶는다.
 * 목록이 범례를 겸한다: 같은 색 표시 · 이름 · % 를 모두 보여 줘 색만으로 구분하지 않는다
 */
export function ShareDonut({ items, onSelect }: { items: ShareItem[]; onSelect?: (id: string) => void }) {
  const sorted = items.toSorted((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, it) => sum + it.value, 0);
  const pctOf = (v: number) => (total === 0 ? 0 : Math.round((v / total) * 100));
  const colorOf = (i: number) => SHARE_COLORS[i] ?? OTHER_COLOR;
  // 「기타」가 하나뿐이면 묶지 않고 그대로 한 줄로 보여 준다
  const headCount = sorted.length === SHARE_COLORS.length + 1 ? sorted.length : SHARE_COLORS.length;
  const rest = sorted.slice(headCount);
  // 끝 칸(순위 변화 등)이 하나라도 있으면 모든 줄에 같은 폭을 비워 둬 %가 한 줄로 맞게
  const hasExtra = sorted.some((it) => it.extra !== undefined);
  const slices = [
    ...sorted.slice(0, headCount).map((it, i) => ({ id: it.id, label: it.label, value: it.value, color: colorOf(i) })),
    ...(rest.length > 0 ? [{ id: OTHER_ID, label: `기타 ${rest.length}개`, value: rest.reduce((sum, it) => sum + it.value, 0), color: OTHER_COLOR }] : []),
  ];
  const select = (id: string) => {
    if (onSelect && id !== OTHER_ID) onSelect(id);
  };

  const row = (it: ShareItem, color: string) => (
    <button
      type="button"
      disabled={!onSelect}
      onClick={() => select(it.id)}
      className="flex w-full items-center gap-2 rounded px-1 leading-7 text-left enabled:hover:bg-muted"
    >
      <span aria-hidden className="size-3 shrink-0 rounded-sm" style={{ background: color }} />
      <span className="min-w-0 flex-1 truncate pr-3">
        {it.label}
        {it.hint && <span className="ml-1 text-xs text-muted-foreground">{it.hint}</span>}
      </span>
      {it.sub && <span className="shrink-0 text-xs text-muted-foreground">{it.sub}</span>}
      <span className="w-10 shrink-0 text-right font-semibold tabular-nums">{pctOf(it.value)}%</span>
      {hasExtra && <span className="w-7 shrink-0 text-right">{it.extra}</span>}
    </button>
  );

  return (
    // 색이 있는 5개만 한 줄씩, 나머지는 회색 「기타」 한 줄 + 이름·% 나열 (목록이 그래프보다 길어져 빈 공간이 생기지 않게)
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="size-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              innerRadius="58%"
              outerRadius="100%"
              stroke="var(--card)"
              strokeWidth={2}
              isAnimationActive={false}
              onClick={(_d, index) => select(slices[index].id)}
              className={onSelect ? "cursor-pointer" : undefined}
            >
              {slices.map((s) => (
                <Cell key={s.id} fill={s.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => `${pctOf(Number(v))}%`} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="min-w-0 flex-1 text-[15px]">
        <ol>
          {sorted.slice(0, headCount).map((it, i) => (
            <li key={it.id}>{row(it, colorOf(i))}</li>
          ))}
        </ol>
        {rest.length > 0 && (
          <div>
            {row({ id: OTHER_ID, label: `기타 ${rest.length}개`, value: rest.reduce((sum, it) => sum + it.value, 0) }, OTHER_COLOR)}
            <p className="pl-6 text-xs leading-5 text-muted-foreground">
              {rest.map((it, i) => (
                <span key={it.id}>
                  {i > 0 && " · "}
                  <button type="button" disabled={!onSelect} onClick={() => select(it.id)} className="enabled:hover:text-foreground enabled:hover:underline">
                    {it.label} {pctOf(it.value)}%{it.sub ? ` (${it.sub})` : ""}
                  </button>
                  {it.extra !== undefined && <span className="ml-0.5">{it.extra}</span>}
                </span>
              ))}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
