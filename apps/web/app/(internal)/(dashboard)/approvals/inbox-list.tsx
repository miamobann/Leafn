"use client";

// 결재함의 결재 대기 목록 (팀장만). 탭으로 거르고, 한 건을 펼치면 그 자리에서 내용을 보고 바로 승인 · 반려한다.
// 「원본 탭에서 보기」는 시안을 만든 탭 화면(리뷰 리포트 · 광고 검토 상세)으로, 「자세히」는 버전 미리보기 페이지로 간다
import Link from "next/link";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { SUBMISSION_TAB_LABELS, type SubmissionTab } from "@/lib/schemas/submission";
import { DecisionForm } from "./[versionId]/decision-form";

const TEXT = {
  all: "전체",
  empty: "결재를 기다리는 시안이 없어요.",
  emptyTab: (tab: string) => `${tab} 탭에는 결재를 기다리는 시안이 없어요.`,
  open: "미리보기 · 결재",
  close: "접기",
  source: "원본 탭에서 보기",
  detail: "자세히 (이전 버전 비교)",
  waiting: (days: number) => (days === 0 ? "오늘 제출" : `${days}일째 대기`),
  note: "메모",
};

export type InboxItem = {
  id: string;
  tab: SubmissionTab;
  productName: string;
  versionNo: number;
  summary: string;
  note: string | null;
  authorName: string;
  submittedLabel: string;
  waitingDays: number;
  stale: boolean;
  sourceHref: string;
  isSelf: boolean;
  riskWarning: string | null;
  /** 서버에서 그린 버전 내용 (SubmissionBody) */
  preview: React.ReactNode;
};

export function InboxList({ items, canDecide }: { items: InboxItem[]; canDecide: boolean }) {
  const [tab, setTab] = useState<SubmissionTab | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const tabs = (Object.keys(SUBMISSION_TAB_LABELS) as SubmissionTab[]).map((t) => ({
    key: t,
    label: SUBMISSION_TAB_LABELS[t],
    count: items.filter((i) => i.tab === t).length,
  }));
  const shown = tab === "all" ? items : items.filter((i) => i.tab === tab);

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="탭별 시안" className="flex flex-wrap gap-2">
        {[{ key: "all" as const, label: TEXT.all, count: items.length }, ...tabs].map((t) => (
          <Button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            size="sm"
            variant={tab === t.key ? "default" : "outline"}
            onClick={() => setTab(t.key)}
          >
            {t.label} {t.count}
          </Button>
        ))}
      </div>

      {shown.length === 0 && (
        <p className="rounded-md border p-4 text-sm text-muted-foreground">
          {tab === "all" ? TEXT.empty : TEXT.emptyTab(SUBMISSION_TAB_LABELS[tab])}
        </p>
      )}

      <ul className="space-y-2">
        {shown.map((item) => {
          const open = openId === item.id;
          return (
            <li key={item.id} className="rounded-lg border bg-card">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 p-4 text-sm">
                <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">{SUBMISSION_TAB_LABELS[item.tab]}</span>
                <span className="font-medium">
                  {item.productName} · v{item.versionNo}
                </span>
                <span className="text-muted-foreground">
                  {item.authorName} · {item.submittedLabel}
                </span>
                <span className={item.stale ? "font-semibold text-status-pending" : "text-muted-foreground"}>
                  {TEXT.waiting(item.waitingDays)}
                </span>
                <span className="ml-auto flex flex-wrap gap-2">
                  <Link href={item.sourceHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    {TEXT.source}
                  </Link>
                  <Button size="sm" aria-expanded={open} onClick={() => setOpenId(open ? null : item.id)}>
                    {open ? TEXT.close : TEXT.open}
                  </Button>
                </span>
                <p className="basis-full">{item.summary || "—"}</p>
              </div>
              {open && (
                <div className="space-y-4 border-t p-4">
                  {item.note && (
                    <p className="text-sm">
                      <span className="font-medium">{TEXT.note}</span> {item.note}
                    </p>
                  )}
                  {item.preview}
                  <Link href={`/approvals/${item.id}`} className="text-sm underline-offset-4 hover:underline">
                    {TEXT.detail}
                  </Link>
                  {canDecide && <DecisionForm versionId={item.id} isSelf={item.isSelf} riskWarning={item.riskWarning} />}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
