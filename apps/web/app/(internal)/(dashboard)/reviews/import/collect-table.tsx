// 수집 결과 표: ② 저장할 제품 고르기(체크) · ③ 저장 결과(이번에 저장한 리뷰).
import { Check } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CollectionRowView } from "@/lib/data/collection";
import { cn } from "@/lib/utils";
import { LOW_REVIEW_FLOOR, looksOptioned, n } from "./collect-options";

function hintOf(r: CollectionRowView, starLabel: string) {
  if (r.failed) return r.note ?? "리뷰 페이지를 열지 못했어요";
  if (r.isSet) return "세트 상품이라 비교에 맞지 않아요";
  if ((r.lowCount ?? 0) < LOW_REVIEW_FLOOR) return `${starLabel} 리뷰가 ${n(r.lowCount ?? 0)}건뿐이라 비교하기 어려워요`;
  if (looksOptioned(r.name)) return "옵션 상품이에요. 한 종류만 있는지 확인하고 골라 주세요";
  return null;
}

export function ResultTable({
  rows,
  selected,
  platformLabel,
  starLabel,
  saved,
  busy,
  onToggle,
  onToggleAll,
}: {
  rows: CollectionRowView[];
  selected: Set<string>;
  platformLabel: string;
  /** 요청한 별점 (예: 3점, 1·2점) */
  starLabel: string;
  saved: boolean;
  busy: boolean;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
}) {
  const allSelected = rows.length > 0 && selected.size === rows.length;
  return (
    <div className="overflow-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="w-10">
              {!saved && <input type="checkbox" className="size-4 accent-primary" aria-label="전체 선택" checked={allSelected} disabled={busy} onChange={onToggleAll} />}
            </TableHead>
            <TableHead className="w-14">순위</TableHead>
            <TableHead>경쟁 제품</TableHead>
            <TableHead>{platformLabel} 리뷰</TableHead>
            <TableHead>{saved ? "이번에 저장한 리뷰" : "새로 저장할 리뷰"}</TableHead>
            <TableHead>이미 저장된 리뷰</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const savedNow = r.savedNow ?? 0;
            const dim = r.failed || (r.lowCount ?? 0) < LOW_REVIEW_FLOOR || (saved && savedNow === 0);
            const check = !saved && !r.failed && looksOptioned(r.name);
            const hint = saved ? null : hintOf(r, starLabel);
            return (
              <TableRow key={r.id} className={cn("align-top", dim && "text-muted-foreground")}>
                <TableCell>
                  {saved ? (
                    savedNow > 0 && <Check className="size-4 text-status-approved" strokeWidth={3} aria-label="저장함" />
                  ) : (
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      aria-label={`${r.rank}위 선택`}
                      checked={selected.has(r.id)}
                      disabled={busy || r.failed}
                      onChange={() => onToggle(r.id)}
                    />
                  )}
                </TableCell>
                <TableCell>{r.rank}</TableCell>
                <TableCell className="whitespace-normal">
                  <span lang="ja">
                    {r.brand} {r.name}
                  </span>
                  {check && <span className="ml-1.5 rounded border border-status-pending/60 px-1.5 text-xs text-status-pending">확인 필요</span>}
                  {hint && <p className={cn("mt-0.5 text-xs", check ? "text-status-pending" : "text-muted-foreground")}>{hint}</p>}
                </TableCell>
                <TableCell className="whitespace-normal">
                  <p className="tabular-nums">{r.siteCount === null ? "—" : `${n(r.siteCount)}건`}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {r.stars.map((x) => (x.read === null ? `${x.star}점 —` : `${x.star}점 ${n(x.read)}건${x.exhausted === false ? " 이상" : ""}`)).join(" · ")}
                  </p>
                </TableCell>
                <TableCell className="tabular-nums">
                  {saved ? (
                    savedNow > 0 ? <b className="text-status-approved">+{n(savedNow)}건</b> : "—"
                  ) : r.failed ? (
                    "읽지 못함"
                  ) : r.newCount === 0 ? (
                    <span className="text-muted-foreground">없음 · 모두 저장됨</span>
                  ) : (
                    <b>{n(r.newCount)}건</b>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">{r.savedCount > 0 ? `${n(r.savedCount)}건` : "—"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
