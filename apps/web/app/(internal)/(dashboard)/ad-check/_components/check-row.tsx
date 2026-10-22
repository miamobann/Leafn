// 검토 이력 한 건. 누르면 펼쳐져 줄별 판정과 담당자 기록을 보여준다 (별도 상세 페이지 대신).
import { ActionBadge, StatusBadge } from "./badges";
import { LineResultCard } from "./line-result-card";
import type { ResolvedAdCheck } from "../_lib/types";

export function CheckRow({ check }: { check: ResolvedAdCheck }) {
  return (
    <details className="group rounded-lg border border-border">
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm hover:bg-sidebar">
        <span className="w-32 text-muted">{check.createdAt}</span>
        <span className="min-w-40 flex-1 font-medium">
          {check.productName} · {check.usage}
        </span>
        <span className="text-muted">{check.lines.length}줄</span>
        <ActionBadge action={check.overallAction} />
        <StatusBadge status={check.status} />
        <span className="w-24 text-muted">{check.reviewer ?? "담당자 미정"}</span>
      </summary>

      <div className="flex flex-col gap-4 border-t border-border p-4">
        <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted">요청자</dt>
          <dd>{check.requester}</dd>
          <dt className="text-muted">담당자 메모</dt>
          <dd>{check.reviewerNote || "—"}</dd>
          <dt className="text-muted">최종 문구</dt>
          <dd className="whitespace-pre-line">{check.finalText || "—"}</dd>
          <dt className="text-muted">판정 정보</dt>
          <dd className="text-xs text-muted">
            모델: {check.model} · 프롬프트: {check.promptVersion}
          </dd>
        </dl>
        {check.lines.map((line) => (
          <LineResultCard key={line.lineIndex} line={line} />
        ))}
      </div>
    </details>
  );
}
