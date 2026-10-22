import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { CheckRow } from "../_components/check-row";
import { DisclaimerBanner } from "../_components/disclaimer-banner";
import { EmptyView, ErrorView, LoadingView, parseViewState } from "../_components/state-view";
import { getAdChecks } from "../_lib/data";
import { STATUS_DISPLAY } from "../_lib/display";
import { REVIEW_STATUSES, type ReviewStatus } from "../_lib/types";

const COPY = {
  empty: "조건에 맞는 검토 이력이 없습니다.",
  loading: "검토 이력을 불러오는 중",
  error: "검토 이력을 불러오지 못했습니다 (예시 화면).",
  all: "전체",
  newCheck: "새 검토 시작",
};

function parseStatus(value: string | string[] | undefined): ReviewStatus | undefined {
  return REVIEW_STATUSES.find((s) => s === value);
}

type HistoryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdCheckHistoryPage({ searchParams }: HistoryPageProps) {
  const params = await searchParams;
  const viewState = parseViewState(params.state);
  const status = parseStatus(params.status);
  const checks = await getAdChecks({ status });

  const filters: { label: string; href: string; active: boolean }[] = [
    { label: COPY.all, href: "/ad-check/history", active: !status },
    ...REVIEW_STATUSES.map((s) => ({
      label: `${STATUS_DISPLAY[s].icon} ${STATUS_DISPLAY[s].label}`,
      href: `/ad-check/history?status=${s}`,
      active: status === s,
    })),
  ];

  function renderList() {
    if (viewState === "loading") return <LoadingView message={COPY.loading} />;
    if (viewState === "error") return <ErrorView message={COPY.error} />;
    if (viewState === "empty" || checks.length === 0) {
      return (
        <EmptyView message={COPY.empty}>
          <Link href="/ad-check" className="rounded-md border border-border px-3 py-1.5 hover:bg-sidebar">
            {COPY.newCheck}
          </Link>
        </EmptyView>
      );
    }
    return (
      <div className="flex flex-col gap-2">
        {checks.map((check) => (
          <CheckRow key={check.id} check={check} />
        ))}
      </div>
    );
  }

  return (
    <>
      <PageHeader title="검토 이력" description="원문, 수정 제안, 담당자 검토 결과" featureId="A" />
      <DisclaimerBanner />
      <nav aria-label="검토 상태 필터" className="mb-4 flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f.href}
            href={f.href}
            aria-current={f.active ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-sm ${
              f.active ? "border-foreground bg-sidebar-accent font-medium" : "border-border text-muted hover:bg-sidebar"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {renderList()}
    </>
  );
}
