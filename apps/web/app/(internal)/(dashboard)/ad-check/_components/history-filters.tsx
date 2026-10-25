"use client";

// 목록 필터 (검토 이력: 제품 · 검토 상태 / 만든 콘텐츠: 제품 · 채널). 고른 값은 주소(?product=&status=…)에 남아 새로고침해도 유지된다.
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// shadcn select는 아직 설치되지 않아 기본 select를 같은 모양으로 쓴다 (components/ui는 공용 영역)
const SELECT = "h-9 rounded-md border border-input bg-transparent px-3 text-sm";

type Option = { value: string; label: string };

/** key = 주소 칸 이름. allLabel 이 없으면 「전체」 없이 options 중 하나를 고른다 (첫 값이 기본) */
export type HistoryFilter = { key: string; label: string; options: Option[]; allLabel?: string | null };

export function HistoryFilters({ filters }: { filters: HistoryFilter[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function change(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      {filters.map((f) => {
        const hasAll = f.allLabel !== null;
        return (
          <label key={f.key} className="flex items-center gap-2">
            {f.label}
            <select className={SELECT} value={params.get(f.key) ?? (hasAll ? "" : (f.options[0]?.value ?? ""))} onChange={(e) => change(f.key, e.target.value)}>
              {hasAll && <option value="">{f.allLabel ?? "전체"}</option>}
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
}
