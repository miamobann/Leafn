// AI 분석 (docs/team-approval-ai-analysis.md 3장 5~6, 7장 4단계): 탭별 승인본을 모아 통합 분석을 돌리고 결과를 팀 전체가 본다.
// 다시 돌리면 새 결과가 쌓이고 이전 결과도 남는다
import { AiCheckBadge } from "@/components/common/submission-badges";
import { PageHeader } from "@/components/layout/page-header";
import { DataTableTemplate } from "@/components/templates";
import { MAX_DATA_GAP_DAYS } from "@/lib/ai/integrated-analysis/config";
import { getProducts } from "@/lib/data";
import { getAiAnalyses, getApprovedVersionsFor, PROJECT_SCOPE_LABEL } from "@/lib/data/submissions";
import { isSupabaseConfigured } from "@/lib/data/workspace";
import { formatDate } from "@/lib/format";
import type { SubmissionTab } from "@/lib/schemas/submission";
import { type ProductOption, RunForm, type VersionOption } from "./run-form";

const TEXT = {
  title: "AI 분석",
  description: "팀장이 승인한 탭별 결론만 모아 제품 하나의 진출 판단을 정리해요. 결과는 팀 전체에 공유돼요.",
  results: "분석 결과",
};

export default async function AiAnalysisPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const [products, analyses] = await Promise.all([getProducts({ kind: "own" }), getAiAnalyses()]);
  const onSale = products.flatMap((p) => (p.project_id && p.sale_status === "on_sale" ? [{ ...p, project_id: p.project_id }] : []));

  const options: ProductOption[] = await Promise.all(
    onSale.map(async (p) => {
      const byTab: Record<SubmissionTab, VersionOption[]> = { market: [], review: [], ad: [] };
      const defaults: Record<SubmissionTab, string> = { market: "", review: "", ad: "" };
      // 제품 단위 시안을 먼저 두어, 시장 분석은 제품 단위 승인본이 있으면 그것이 기본값이 된다
      const groups = (await getApprovedVersionsFor(p.project_id, p.id)).toSorted(
        (a, b) => Number(b.submission.product_id !== null) - Number(a.submission.product_id !== null),
      );
      for (const { submission, approved } of groups) {
        for (const v of approved) {
          const scope = submission.product_id ? "" : ` · ${PROJECT_SCOPE_LABEL}`;
          byTab[submission.tab].push({ id: v.id, label: `v${v.version_no}${scope} · ${v.summary.slice(0, 40)}`, dataAsOf: v.data_as_of });
        }
        // 기본값은 지금 기준 승인본 (설계 3장 5)
        if (!defaults[submission.tab] && submission.approved_version_id) defaults[submission.tab] = submission.approved_version_id;
      }
      return { id: p.id, name: p.name, byTab, defaults };
    }),
  );
  const productName = (id: string | null) => products.find((p) => p.id === id)?.name ?? "—";

  return (
    <>
      <PageHeader title={TEXT.title} description={TEXT.description} featureId="N" />
      <RunForm
        products={options}
        initialProductId={typeof params.product === "string" ? params.product : null}
        sampleMode={!isSupabaseConfigured()}
        maxGapDays={MAX_DATA_GAP_DAYS}
      />
      <h2 className="mt-8 mb-3 font-semibold">{TEXT.results}</h2>
      <DataTableTemplate
        columns={[
          { key: "title", label: "제목" },
          { key: "product", label: "제품" },
          { key: "date", label: "실행일" },
          { key: "check", label: "확인" },
          { key: "prompt", label: "프롬프트" },
        ]}
        rows={analyses.map((a) => ({
          id: a.id,
          href: `/ai-analysis/${a.id}`,
          cells: {
            title: a.title,
            product: productName(a.product_id),
            date: formatDate(a.created_at),
            check: <AiCheckBadge checked={a.lead_checked_at !== null} />,
            prompt: <span className="text-xs text-muted-foreground">{a.prompt_version}</span>,
          },
        }))}
      />
    </>
  );
}
