// 수집 결과 표(제품 고르기)와 "자동으로 뺀 제품" 목록.
import type { CollectionRowView, CollectionView } from "@/lib/data/collection";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LOW_REVIEW_FLOOR, looksOptioned, SKIP_REASON_LABEL, TEXT, unfit } from "./collect-options";
import { n, StateCell } from "./collect-parts";

function hintOf(r: CollectionRowView) {
  if (r.failed) return null;
  if (r.isSet) return "세트 상품이라 비교에 맞지 않아요";
  if ((r.lowCount ?? 0) < LOW_REVIEW_FLOOR) return "불만 리뷰가 거의 없어요";
  if (looksOptioned(r.name)) return "옵션·시리즈 상품이에요. 화장수만 있는지 확인하고 선택해 주세요";
  return null;
}

export function ResultTable({
  rows,
  selected,
  platformLabel,
  saved,
  busy,
  onToggle,
  onToggleAll,
}: {
  rows: CollectionRowView[];
  selected: Set<string>;
  platformLabel: string;
  saved: boolean;
  busy: boolean;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
}) {
  const allSelected = rows.length > 0 && selected.size === rows.length;
  return (
    <div className="max-h-[28rem] overflow-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <input type="checkbox" className="size-4 accent-primary" aria-label={TEXT.selectAll} checked={allSelected} disabled={busy || saved} onChange={onToggleAll} />
            </TableHead>
            <TableHead className="w-14">{TEXT.rankCol}</TableHead>
            <TableHead>{TEXT.productCol}</TableHead>
            <TableHead>
              {platformLabel}에 있는 리뷰
              <span className="block text-xs font-normal text-muted-foreground">{TEXT.siteCountNote}</span>
            </TableHead>
            <TableHead>{TEXT.stateCol}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const hint = hintOf(r);
            return (
              <TableRow key={r.id} className={unfit(r) ? "text-muted-foreground" : undefined}>
                <TableCell>
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    aria-label={`${r.rank}위 선택`}
                    checked={selected.has(r.id)}
                    disabled={busy || saved || r.failed}
                    onChange={() => onToggle(r.id)}
                  />
                </TableCell>
                <TableCell className="font-medium">{r.rank}</TableCell>
                <TableCell className="whitespace-normal">
                  <span lang="ja">
                    {r.brand} {r.name}
                  </span>
                  {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
                </TableCell>
                <TableCell className="whitespace-normal">
                  <p className="tabular-nums">{r.siteCount === null ? "—" : `${n(r.siteCount)}건`}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {r.stars.map((x) => (x.read === null ? `${x.star}점 —` : `${x.star}점 ${n(x.read)}건${x.exhausted === false ? " 이상" : ""}`)).join(" · ")}
                  </p>
                </TableCell>
                <TableCell className="whitespace-normal">
                  <StateCell row={r} saved={saved} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/** 수집기가 비교 대상이 아니라고 자동으로 뺀 제품. 리뷰는 읽지 않았고 보기만 가능하다 */
export function SkippedList({ skipped }: { skipped: CollectionView["skipped"] }) {
  if (skipped.length === 0) return null;
  return (
    <details className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      <summary className="cursor-pointer font-medium text-foreground">자동으로 뺀 제품 {skipped.length}개 (비교에 맞지 않아 리뷰를 읽지 않았어요)</summary>
      <ul className="mt-2 space-y-1">
        {skipped.map((s) => (
          <li key={s.id} className="flex gap-2">
            <span className="w-8 shrink-0 tabular-nums">{s.rank}위</span>
            <span className="min-w-0 flex-1">
              <span lang="ja" className="break-words">
                {s.brand} {s.name}
              </span>
              <span className="block">{SKIP_REASON_LABEL[s.reason]}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2">제목을 보고 거른 것이라 잘못 뺀 제품이 있을 수 있어요. 이 목록은 보기만 가능해요.</p>
    </details>
  );
}
