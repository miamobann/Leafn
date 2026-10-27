// 판단 문장 옆의 근거 버전 링크 (결재함 미리보기로 간다). 입력에 없는 ref를 인용했으면 "근거 확인 필요"를 붙인다.
// 설문 요약을 인용했으면 설문 집계 화면으로 가는 「설문 · 참고」를 붙인다 (결재 전 참고 데이터, 프롬프트 v4)
import Link from "next/link";
import type { AiAnalysisPoint } from "@/lib/schemas/ai-analysis";
import { SURVEY_REF_LABEL, SURVEY_REFERENCE_NOTE } from "./labels";

export function Basis({ point, refOf }: { point: Pick<AiAnalysisPoint, "basis" | "needs_check" | "survey">; refOf: Record<string, string> }) {
  return (
    <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
      {point.basis.map((id) => (
        <Link key={id} href={`/approvals/${id}`} className="rounded border px-1 text-xs font-normal text-muted-foreground hover:text-foreground">
          {refOf[id] ?? "?"}
        </Link>
      ))}
      {point.survey && (
        <Link
          href="/survey-results"
          title={SURVEY_REFERENCE_NOTE}
          className="rounded border border-dashed px-1 text-xs font-normal text-muted-foreground hover:text-foreground"
        >
          {SURVEY_REF_LABEL}
        </Link>
      )}
      {point.needs_check && <span className="rounded bg-status-pending/15 px-1 text-xs font-normal text-status-pending">근거 확인 필요</span>}
    </span>
  );
}
