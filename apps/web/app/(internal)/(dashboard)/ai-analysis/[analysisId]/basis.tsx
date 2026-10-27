// 판단 문장 옆의 근거 버전 링크 (결재함 미리보기로 간다). 입력에 없는 ref를 인용했으면 "근거 확인 필요"를 붙인다
import Link from "next/link";
import type { AiAnalysisPoint } from "@/lib/schemas/ai-analysis";

export function Basis({ point, refOf }: { point: Pick<AiAnalysisPoint, "basis" | "needs_check">; refOf: Record<string, string> }) {
  return (
    <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
      {point.basis.map((id) => (
        <Link key={id} href={`/approvals/${id}`} className="rounded border px-1 text-xs font-normal text-muted-foreground hover:text-foreground">
          {refOf[id] ?? "?"}
        </Link>
      ))}
      {point.needs_check && <span className="rounded bg-status-pending/15 px-1 text-xs font-normal text-status-pending">근거 확인 필요</span>}
    </span>
  );
}
