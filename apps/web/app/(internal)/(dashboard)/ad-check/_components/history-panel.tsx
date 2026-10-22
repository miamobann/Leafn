import Link from "next/link";
import { CheckRow } from "./check-row";
import { EmptyView } from "./state-view";
import type { ResolvedAdCheck } from "../_lib/types";

export function HistoryPanel({ checks }: { checks: ResolvedAdCheck[] }) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">최근 검토 이력</h2>
        <Link href="/ad-check/history" className="text-sm text-muted underline underline-offset-4">
          전체 이력 보기
        </Link>
      </div>
      {checks.length === 0 ? (
        <EmptyView message="아직 검토 이력이 없습니다." />
      ) : (
        <div className="flex flex-col gap-2">
          {checks.map((check) => (
            <CheckRow key={check.id} check={check} />
          ))}
        </div>
      )}
    </section>
  );
}
