// 화면 템플릿 7종 골격 (prototype-plan 4.1). 모든 템플릿은 state로 4가지 상태를 보여준다.
import Link from "next/link";
import { ViewStateGate } from "@/components/common/view-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ViewState } from "@/lib/schemas/common";

type Base = { state?: ViewState; emptyAction?: string };

/** T1 요약: 숫자 카드 줄 + 목록 위젯 */
export function OverviewTemplate({
  stats,
  sections,
  state,
  emptyAction,
}: Base & { stats: { label: string; value: string }[]; sections: { title: string; items: React.ReactNode[] }[] }) {
  return (
    <ViewStateGate state={state} emptyAction={emptyAction}>
      <div className="grid grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4">
        {sections.map((sec) => (
          <Card key={sec.title}>
            <CardHeader>
              <CardTitle>{sec.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {sec.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </ViewStateGate>
  );
}

export type Column = { key: string; label: string; align?: "right" };
export type Row = { id: string; href?: string; cells: Record<string, React.ReactNode> };

/** T2 표: 필터 바 + 표 + 행을 누르면 상세 */
export function DataTableTemplate({
  filters,
  columns,
  rows,
  state,
  emptyAction,
}: Base & { filters?: React.ReactNode; columns: Column[]; rows: Row[] }) {
  return (
    <ViewStateGate state={rows.length === 0 ? "empty" : state} emptyAction={emptyAction}>
      {filters && <div className="mb-4 flex flex-wrap items-center gap-2">{filters}</div>}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.key} className={c.align === "right" ? "text-right" : undefined}>
                  {c.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                {columns.map((c, i) => (
                  <TableCell key={c.key} className={c.align === "right" ? "text-right" : undefined}>
                    {i === 0 && row.href ? (
                      <Link href={row.href} className="underline-offset-4 hover:underline">
                        {row.cells[c.key]}
                      </Link>
                    ) : (
                      row.cells[c.key]
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ViewStateGate>
  );
}

/** T3 차트 리포트: 필터 + 차트 카드 격자 (+ 근거 패널은 각 페이즈에서) */
export function ReportTemplate({
  filters,
  cards,
  state,
  emptyAction,
}: Base & { filters?: React.ReactNode; cards: { title: string; content: React.ReactNode; wide?: boolean }[] }) {
  return (
    <ViewStateGate state={state} emptyAction={emptyAction}>
      {filters && <div className="mb-4 flex flex-wrap items-center gap-2">{filters}</div>}
      <div className="grid grid-cols-2 gap-4">
        {cards.map((card) => (
          <Card key={card.title} className={card.wide ? "col-span-2" : undefined}>
            <CardHeader>
              <CardTitle>{card.title}</CardTitle>
            </CardHeader>
            <CardContent>{card.content}</CardContent>
          </Card>
        ))}
      </div>
    </ViewStateGate>
  );
}

/** 차트 자리: 가로 막대 목록. 실제 차트(Recharts)는 P3·P4에서 바꾼다. */
export function BarList({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2 text-sm">
      {items.map((item) => (
        <li key={item.label} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-2">
          <span className="truncate">{item.label}</span>
          <span className="h-2 rounded bg-chart-2" style={{ width: `${(item.value / max) * 100}%` }} />
          <span className="text-right text-muted-foreground">{item.value}</span>
        </li>
      ))}
    </ul>
  );
}

/** T4 문구 검토: 입력 패널 + 결과 패널 + 승인 바 */
export function TextReviewTemplate({
  input,
  result,
  state,
}: Base & { input: React.ReactNode; result: React.ReactNode }) {
  return (
    <ViewStateGate state={state}>
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>입력</CardTitle>
          </CardHeader>
          <CardContent>{input}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>결과</CardTitle>
          </CardHeader>
          <CardContent>{result}</CardContent>
        </Card>
      </div>
      <ApprovalBar />
    </ViewStateGate>
  );
}

export function ApprovalBar() {
  return (
    <div className="mt-4 flex items-center justify-end gap-2 rounded-lg border p-3">
      <span className="mr-auto text-xs text-muted-foreground">저장되지 않음 · P2에서 연결</span>
      <Button variant="outline" disabled>
        반려
      </Button>
      <Button disabled>승인</Button>
    </div>
  );
}

/** T5 캘린더: 목록 보기 (월 보기는 P6에서 FullCalendar로) */
export function CalendarTemplate({
  events,
  state,
}: Base & { events: { id: string; title: string; period: string; due: string; meta?: React.ReactNode }[] }) {
  return (
    <ViewStateGate state={events.length === 0 ? "empty" : state}>
      <ul className="space-y-2">
        {events.map((e) => (
          <li key={e.id} className="flex items-center gap-4 rounded-lg border p-4 text-sm">
            <span className="w-16 font-semibold">{e.due}</span>
            <div className="flex-1">
              <p className="font-medium">{e.title}</p>
              <p className="text-muted-foreground">{e.period}</p>
            </div>
            {e.meta}
          </li>
        ))}
      </ul>
    </ViewStateGate>
  );
}

/** T6 단계형 폼: 진행 바 + 한 화면 한 단계 + 이전/다음 */
export function StepFormTemplate({
  step,
  total,
  prevHref,
  nextHref,
  prevLabel = "이전",
  nextLabel = "다음",
  nextDisabled,
  children,
  state,
}: Base & {
  step: number;
  total: number;
  prevHref?: string;
  nextHref?: string;
  prevLabel?: string;
  nextLabel?: string;
  nextDisabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <ViewStateGate state={state}>
      <Progress value={(step / total) * 100} aria-label={`${step}/${total}`} />
      <p className="mt-2 text-right text-xs text-muted-foreground">
        {step} / {total}
      </p>
      <div className="my-6">{children}</div>
      <div className="flex justify-between gap-2">
        {prevHref ? (
          <Link href={prevHref} className="text-sm underline-offset-4 hover:underline">
            {prevLabel}
          </Link>
        ) : (
          <span />
        )}
        {nextHref &&
          (nextDisabled ? (
            <Button disabled>{nextLabel}</Button>
          ) : (
            <Link href={nextHref} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
              {nextLabel}
            </Link>
          ))}
      </div>
    </ViewStateGate>
  );
}

/** T7 상세: 헤더(배지) + 속성 목록 + 섹션 */
export function DetailTemplate({
  badges,
  attributes,
  sections,
  state,
}: Base & {
  badges?: React.ReactNode;
  attributes: { label: string; value: React.ReactNode }[];
  sections?: { title: string; content: React.ReactNode }[];
}) {
  return (
    <ViewStateGate state={state}>
      {badges && <div className="mb-4 flex flex-wrap gap-2">{badges}</div>}
      <Card>
        <CardContent>
          <dl className="grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
            {attributes.map((a) => (
              <div key={a.label} className="contents">
                <dt className="text-muted-foreground">{a.label}</dt>
                <dd>{a.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      {sections?.map((s) => (
        <Card key={s.title} className="mt-4">
          <CardHeader>
            <CardTitle>{s.title}</CardTitle>
          </CardHeader>
          <CardContent>{s.content}</CardContent>
        </Card>
      ))}
    </ViewStateGate>
  );
}
