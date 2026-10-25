// 제품 × 탭 진행 표 (docs/team-approval-ai-analysis.md 3장 D안 · 7장 3단계, CLAUDE.md 1장 L).
// 한 칸 = 시안 하나(tab_submissions)의 상태. 판매 중 자사 제품만 줄이 되고, 개발 중 제품은 판매를 시작하면 들어온다.
// 시장 분석은 프로젝트 전체 시안도 있어 맨 위에 한 줄을 더 둔다 (8장 보완 6)
import Link from "next/link";
import { AiCheckBadge, SubmissionStatusBadge } from "@/components/common/submission-badges";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getProgressGrid, PROJECT_SCOPE_LABEL, type ProgressCell } from "@/lib/data/submissions";
import { SUBMISSION_TAB_LABELS, SubmissionTab } from "@/lib/schemas/submission";

const TEXT = {
  title: (project: string) => `${project} 진행 표`,
  description: "칸을 누르면 그 시안의 최신 버전을 미리 봐요. 비어 있는 칸은 아직 시안이 없어요.",
  product: "제품",
  ai: "AI 분석",
  none: "—",
  noProducts: "판매 중인 제품이 없어요. 판매 상태를 바꾸면 여기에 줄이 생겨요.",
};

/** 시안이 없는 칸이 가는 곳: 그 탭에서 결과를 만든 뒤 시안으로 저장한다 */
function tabHref(tab: SubmissionTab, productId: string | null) {
  if (tab === "review" && productId) return `/reviews/${productId}`;
  if (tab === "ad") return "/ad-check/history";
  return "/market";
}

function Cell({ cell, tab, productId }: { cell: ProgressCell; tab: SubmissionTab; productId: string | null }) {
  if (!cell) {
    return (
      <Link href={tabHref(tab, productId)} className="text-muted-foreground underline-offset-4 hover:underline">
        {TEXT.none}
      </Link>
    );
  }
  return cell.latestVersionId ? (
    <Link href={`/approvals/${cell.latestVersionId}`}>
      <SubmissionStatusBadge status={cell.submission.status} />
    </Link>
  ) : (
    <SubmissionStatusBadge status={cell.submission.status} />
  );
}

export async function ProgressGrid({ projectId, projectName }: { projectId: string; projectName: string }) {
  const grid = await getProgressGrid(projectId);
  return (
    <section className="mt-8">
      <h2 className="font-semibold">{TEXT.title(projectName)}</h2>
      <p className="mb-3 text-sm text-muted-foreground">{TEXT.description}</p>
      {grid.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{TEXT.noProducts}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{TEXT.product}</TableHead>
                {SubmissionTab.options.map((tab) => (
                  <TableHead key={tab}>{SUBMISSION_TAB_LABELS[tab]}</TableHead>
                ))}
                <TableHead>{TEXT.ai}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="text-muted-foreground">{PROJECT_SCOPE_LABEL}</TableCell>
                <TableCell>
                  <Cell cell={grid.projectRow.market} tab="market" productId={null} />
                </TableCell>
                <TableCell />
                <TableCell />
                <TableCell />
              </TableRow>
              {grid.rows.map((row) => (
                <TableRow key={row.productId}>
                  <TableCell>{row.productName}</TableCell>
                  {SubmissionTab.options.map((tab) => (
                    <TableCell key={tab}>
                      <Cell cell={row.cells[tab]} tab={tab} productId={row.productId} />
                    </TableCell>
                  ))}
                  <TableCell>
                    {row.latestAnalysis ? (
                      <Link href={`/ai-analysis/${row.latestAnalysis.id}`}>
                        <AiCheckBadge checked={row.latestAnalysis.lead_checked_at !== null} />
                      </Link>
                    ) : (
                      <Link href={`/ai-analysis?product=${row.productId}`} className="text-muted-foreground underline-offset-4 hover:underline">
                        {TEXT.none}
                      </Link>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
