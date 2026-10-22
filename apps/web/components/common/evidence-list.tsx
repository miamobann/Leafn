import { LangBadge } from "@/components/common/badges";
import type { Review } from "@/lib/schemas/review";

// 근거 원문 목록. P3·P4에서 인사이트를 누르면 옆 패널(EvidenceSheet)로 열리게 바꾼다.
export function EvidenceList({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) return <p className="text-sm text-muted-foreground">근거 리뷰가 없어요</p>;
  return (
    <ul className="space-y-2">
      {reviews.map((r) => (
        <li key={r.id} className="rounded-md border p-3 text-sm">
          <div className="mb-1 flex items-center gap-2">
            <LangBadge lang={r.lang} />
            <span className="text-xs text-muted-foreground">★ {r.rating}</span>
          </div>
          <p lang={r.lang}>{r.body}</p>
          {r.body_ko && <p className="mt-1 text-muted-foreground">{r.body_ko}</p>}
        </li>
      ))}
    </ul>
  );
}
