import { PageHeader } from "@/components/layout/page-header";
import { DisclaimerBanner } from "./_components/disclaimer-banner";
import { HistoryPanel } from "./_components/history-panel";
import { ReviewWorkspace } from "./_components/review-workspace";
import { parseViewState } from "./_components/state-view";
import { getAdCheckProducts, getAdChecks, getSampleCopies, getSampleJudgments } from "./_lib/data";

const RECENT_HISTORY = 3;

type AdCheckPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdCheckPage({ searchParams }: AdCheckPageProps) {
  const { state } = await searchParams;
  const forcedState = parseViewState(state);
  const [products, copies, judgments, recent] = await Promise.all([
    getAdCheckProducts(),
    getSampleCopies(),
    getSampleJudgments(),
    getAdChecks({ limit: RECENT_HISTORY }),
  ]);

  return (
    <>
      <PageHeader
        title="새 광고 검토"
        description="약기법 위험 표현, 사유·근거, 대체 표현, 현지화를 줄별로 확인합니다"
        featureId="A"
      />
      <DisclaimerBanner />
      <ReviewWorkspace products={products} copies={copies} judgments={judgments} forcedState={forcedState} />
      <HistoryPanel checks={forcedState === "empty" ? [] : recent} />
    </>
  );
}
