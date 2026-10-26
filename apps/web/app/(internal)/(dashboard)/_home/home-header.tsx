"use client";

// 홈 맨 위 줄: 인사와 요약 세 칸 (2026-10-26 홈 새 디자인). 판매 중 제품은 상단 바에서 고른 프로젝트를 따른다
import Link from "next/link";
import { type ProjectWithProducts, useProjects } from "@/components/layout/project-store";
import { OWN_PRODUCT_LINE } from "@/lib/own-products";

const TEXT = {
  hello: (name: string) => `안녕하세요, ${name}님`,
  sub: "이번 주 할 일과 프로젝트 진행",
  onSale: "판매 중 제품",
  onSaleUnit: "개",
  noOnSale: "판매 중인 제품이 없어요",
  todo: "마감 2주 안 할 일",
  todoUnit: "건",
  urgent: "가장 급한 일",
  noTodo: "2주 안에 다가오는 마감이 없어요",
  next: "다음 행사",
  noNext: "예정된 행사가 없어요",
};

/** 할 일 칸과 다음 행사 칸의 값 (page.tsx가 캘린더 데이터로 계산한다) */
export type HomeTodoSummary = { count: number; urgent: { label: string; when: string; overdue: boolean } | null };
export type HomeNextEvent = { id: string; dDay: string; title: string; date: string } | null;

// 요약 칸 숫자는 시안처럼 브랜드 초록으로 강조한다
const TILE = "flex min-w-0 flex-col gap-0.5 rounded-xl bg-card px-5 py-3.5 ring-1 ring-foreground/10 hover:bg-muted/50";
const VALUE = "text-3xl leading-tight font-normal text-primary tabular-nums";

/** "Leaf& Dew Deep Skin" → "Deep Skin" (요약 칸이 좁아 프로젝트 이름은 뺀다) */
const shortName = (name: string) => (name.startsWith(OWN_PRODUCT_LINE) ? name.slice(OWN_PRODUCT_LINE.length).trim() : name);

export function HomeHeader({
  name,
  dateLabel,
  lines,
  todo,
  next,
  todoHref,
  notice,
}: {
  name: string;
  /** "10월 26일 월요일" */
  dateLabel: string;
  lines: ProjectWithProducts[];
  todo: HomeTodoSummary;
  next: HomeNextEvent;
  /** 할 일 칸을 누르면 갈 곳 (홈 할 일 카드) */
  todoHref: string;
  /** 인사 아래 한 줄 알림 (팀장의 결재 지연). 따로 줄을 만들지 않아 아래 카드가 올라온다 */
  notice?: React.ReactNode;
}) {
  const { current } = useProjects(lines);
  const onSale = (current?.products ?? []).filter((p) => p.sale_status === "on_sale");

  return (
    // 인사는 요약 칸 위쪽 끝에 맞춘다 (아래로 맞추면 상단 바와 사이가 벌어진다)
    <section aria-label="인사와 요약" className="flex flex-wrap items-start gap-5">
      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2">
        <h1 className="text-4xl leading-tight font-light tracking-tight">{TEXT.hello(name)}</h1>
        <p className="text-sm text-muted-foreground">
          {dateLabel} · {TEXT.sub}
        </p>
        {notice}
      </div>
      <div className="grid min-w-0 flex-[2_1_640px] grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        <Link href="/projects" data-slot="card" className={TILE}>
          <span className="text-xs text-muted-foreground">{TEXT.onSale}</span>
          <span className={VALUE}>
            {onSale.length} <span className="text-sm text-foreground/80">{TEXT.onSaleUnit}</span>
          </span>
          <span className="truncate text-xs text-foreground/80">{onSale.length > 0 ? onSale.map((p) => shortName(p.name)).join(" · ") : TEXT.noOnSale}</span>
        </Link>
        <Link href={todoHref} data-slot="card" className={TILE}>
          <span className="text-xs text-muted-foreground">{TEXT.todo}</span>
          <span className={VALUE}>
            {todo.count} <span className="text-sm text-foreground/80">{TEXT.todoUnit}</span>
          </span>
          <span className="truncate text-xs text-foreground/80">
            {/* 칸이 좁아 잘려도 언제까지인지는 보이게 날짜를 먼저 둔다 */}
            {todo.urgent ? (
              <>
                {TEXT.urgent} · <b className={`font-medium ${todo.urgent.overdue ? "text-[#a65a3f]" : ""}`}>{todo.urgent.when}</b> · {todo.urgent.label}
              </>
            ) : (
              TEXT.noTodo
            )}
          </span>
        </Link>
        <Link href={next ? `/calendar?event=${next.id}` : "/calendar"} data-slot="card" className={TILE}>
          <span className="text-xs text-muted-foreground">{TEXT.next}</span>
          <span className={VALUE}>{next ? next.dDay : "—"}</span>
          <span className="truncate text-xs text-foreground/80">{next ? `${next.title} · ${next.date}` : TEXT.noNext}</span>
        </Link>
      </div>
    </section>
  );
}
