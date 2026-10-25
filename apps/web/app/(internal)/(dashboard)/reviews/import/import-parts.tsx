// 리뷰 가져오기 화면의 공통 틀: 첫 갈림길(우리 제품 리뷰 | 경쟁 제품 리뷰), 경쟁 쪽 하위 탭, 큰 단계 표시, 질문 줄, 아래 실행 막대, 저장 끝 패널.
// 우리 제품 화면(own-review-import.tsx)과 경쟁 제품 화면(collect-panel.tsx)이 함께 쓴다.
import { Check, CircleCheck, LoaderCircle } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ImportType = "own" | "competitor";
export type CompetitorTab = "auto" | "csv";

/** 가져오기 화면 주소. 제품(product)은 갈림길과 탭을 옮겨 다녀도 그대로 이어진다 */
export function importHref(type: ImportType, opts: { tab?: CompetitorTab; product?: string | null } = {}) {
  const q = new URLSearchParams({ type });
  if (type === "competitor" && opts.tab === "csv") q.set("tab", "csv");
  if (opts.product) q.set("product", opts.product);
  return `/reviews/import?${q.toString()}`;
}

/** 이동 링크: 진한 회색 글자 + → (파란 밑줄 링크는 쓰지 않는다) */
export const moveLinkClass = "text-sm font-medium text-foreground/85 hover:text-foreground";

export function ImportSwitch({ type, tab, product }: { type: ImportType; tab: CompetitorTab; product: string | null }) {
  const seg = (on: boolean) =>
    cn("flex h-11 items-center gap-2 rounded-lg px-5 text-[15px]", on ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground");
  const sub = (on: boolean) =>
    cn("-mb-px flex h-9 items-center border-b-2 px-0.5 text-sm", on ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground");
  return (
    <div className="space-y-4">
      <div role="tablist" className="inline-flex gap-1 rounded-xl bg-muted p-1">
        <Link role="tab" aria-selected={type === "own"} href={importHref("own", { product })} className={seg(type === "own")}>
          우리 제품 리뷰<span className="text-xs font-normal text-muted-foreground">국내 리뷰 CSV</span>
        </Link>
        <Link role="tab" aria-selected={type === "competitor"} href={importHref("competitor", { product })} className={seg(type === "competitor")}>
          경쟁 제품 리뷰<span className="text-xs font-normal text-muted-foreground">일본 리뷰</span>
        </Link>
      </div>
      {type === "competitor" && (
        <div role="tablist" className="flex gap-5 border-b">
          <Link role="tab" aria-selected={tab === "auto"} href={importHref("competitor", { tab: "auto", product })} className={sub(tab === "auto")}>
            Qoo10에서 자동으로 찾기
          </Link>
          <Link role="tab" aria-selected={tab === "csv"} href={importHref("competitor", { tab: "csv", product })} className={sub(tab === "csv")}>
            CSV 파일로 올리기
          </Link>
        </div>
      )}
    </div>
  );
}

/** 큰 단계 표시. 지난 단계는 체크, 지금 단계는 진하게, 다음 단계는 흐리게. 단계마다 무엇을 하는지 한 줄 */
export function BigStepper({ steps, current }: { steps: readonly (readonly [string, string])[]; current: number }) {
  return (
    <ol className="flex gap-4">
      {steps.map(([label, desc], i) => {
        const step = i + 1;
        const done = step < current;
        const on = step === current;
        return (
          <li
            key={label}
            className={cn("flex flex-1 flex-col gap-2 border-t-[3px] pt-3", on ? "border-foreground" : done ? "border-status-approved" : "border-border")}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-[13px] font-medium",
                  on ? "bg-foreground text-background" : done ? "border-[1.5px] border-status-approved text-status-approved" : "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} aria-label="끝남" /> : step}
              </span>
              <span className={cn("text-[15px]", on ? "font-bold" : done ? "font-medium" : "font-medium text-muted-foreground")}>{label}</span>
              {on && <span className="rounded bg-foreground px-1.5 text-xs text-background">지금</span>}
            </div>
            <span className={cn("text-[13px]", on ? "text-muted-foreground" : "text-muted-foreground/80")}>{desc}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** 질문 한 줄: 왼쪽에 번호 · 질문 · 도움말(줄바꿈 없이), 오른쪽에 입력 칸 */
export function Question({ n, title, hint, children }: { n: string; title: string; hint: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-[440px_minmax(0,1fr)] gap-6 border-t py-5">
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">{n}</span>
        <h3 className="text-base font-semibold whitespace-nowrap">{title}</h3>
        <p className="text-[13px] whitespace-nowrap text-muted-foreground">{hint}</p>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

/** 질문 안의 선택 칸 (라벨 위, 칸 아래) */
export function SelectField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
export const bigSelectClass = "h-10 w-full rounded-md border bg-background px-2.5 text-sm disabled:opacity-50";

/** 아래 실행 막대: 왼쪽에 무엇을 하는지, 오른쪽에 검정 버튼과 작은 안내 */
export function ActionBar({ label, value, note, sticky, children }: { label: string; value: ReactNode; note: string; sticky?: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 rounded-xl border border-foreground bg-background px-5 py-4",
        sticky && "sticky bottom-0 z-10",
      )}
    >
      <div className="flex flex-col gap-1">
        <span className="text-[13px] text-muted-foreground">{label}</span>
        <span className="text-[15px] font-medium">{value}</span>
      </div>
      <div className="flex flex-col items-end gap-1">
        {children}
        <span className="text-xs text-muted-foreground">{note}</span>
      </div>
    </div>
  );
}
export const bigButtonClass = "h-11 px-5 text-[15px]";

/** 조건 · 파일 요약 막대 (회색): 지금 무엇으로 작업 중인지와 되돌리는 버튼 */
export function SummaryBar({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-2 text-sm">{children}</div>
      {action}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cn("animate-spin text-foreground", className)} aria-hidden />;
}

/** 저장 끝 패널 (초록). 제목 · 한 줄 설명 · 본문(숫자, 리포트 상태, 이제 할 일) */
export function SavedPanel({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-status-approved/40 bg-status-approved/5 p-6">
      <div className="flex items-center gap-3">
        <CircleCheck className="size-7 shrink-0 text-status-approved" aria-hidden />
        <div>
          <h2 className="text-[22px] font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

/** 저장 직후 리포트 상태. 분석은 저장 뒤 자동으로 돈다 (2026-10-24 결정) */
export function MakingReport() {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-background px-4 py-3.5">
      <Spinner className="size-[22px]" />
      <div>
        <p className="text-[15px] font-medium">리포트를 만드는 중이에요. 몇 분 안에 끝나요.</p>
        <p className="mt-0.5 text-[13px] text-muted-foreground">다 만들어지면 리뷰 리포트 목록에 &lsquo;준비됨&rsquo;으로 표시할게요.</p>
      </div>
    </div>
  );
}

/** 저장 끝 패널 아래 "이제 할 일" */
export function NextSteps({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] text-muted-foreground">이제 할 일</span>
      <div className="flex flex-wrap items-center gap-6">{children}</div>
    </div>
  );
}
