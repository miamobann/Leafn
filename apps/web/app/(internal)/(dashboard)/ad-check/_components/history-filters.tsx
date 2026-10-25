"use client";

// 검토 내역 필터 2개 (제품 · 검토 상태). 고른 값은 주소(?product=&status=)에 남아 새로고침해도 유지된다.
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// shadcn select는 아직 설치되지 않아 기본 select를 같은 모양으로 쓴다 (components/ui는 공용 영역)
const SELECT = "h-9 rounded-md border border-input bg-transparent px-3 text-sm";

type Option = { value: string; label: string };

type HistoryFiltersProps = {
  products: Option[];
  statuses: Option[];
};

export function HistoryFilters({ products, statuses }: HistoryFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function change(key: "product" | "status", value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <label className="flex items-center gap-2">
        제품
        <select className={SELECT} value={params.get("product") ?? ""} onChange={(e) => change("product", e.target.value)}>
          <option value="">전체</option>
          {products.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        검토 상태
        <select className={SELECT} value={params.get("status") ?? ""} onChange={(e) => change("status", e.target.value)}>
          <option value="">전체</option>
          {statuses.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
