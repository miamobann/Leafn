// 수집 화면 ① 찾을 조건: 질문 1 (우리 제품 · 플랫폼 · 제품 종류 · 몇 개), 질문 2 (가져올 별점 · 별점마다 새로 몇 건).
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CATEGORIES, type CollectForm, REVIEW_LIMITS, STAR_OPTIONS, TOP_N_OPTIONS } from "./collect-options";
import { bigSelectClass, Question, SelectField } from "./import-parts";
import { IMPORT_PLATFORMS } from "./import-platforms";

export function Conditions({
  picker,
  form,
  locked,
  onChange,
}: {
  /** 비교할 우리 제품 칸. 상단 프로젝트 선택기(Min)가 생기면 없앤다 */
  picker: ReactNode;
  form: CollectForm;
  locked: boolean;
  onChange: (patch: Partial<CollectForm>) => void;
}) {
  const toggleStar = (star: number) =>
    onChange({ stars: form.stars.includes(star) ? form.stars.filter((x) => x !== star) : [...form.stars, star].toSorted((a, b) => a - b) });
  return (
    <div className="flex flex-col">
      <Question n="질문 1" title="어디서 어떤 제품을 찾을까요?" hint="리뷰가 많은 제품부터 순서대로 찾아요.">
        <div className="grid grid-cols-2 gap-3">
          {picker}
          <SelectField label="플랫폼">
            <select className={bigSelectClass} value={form.platformId} disabled={locked} onChange={(e) => onChange({ platformId: e.target.value as CollectForm["platformId"] })}>
              {IMPORT_PLATFORMS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </SelectField>
          <SelectField label="제품 종류">
            <select className={bigSelectClass} value={form.categoryId} disabled={locked} onChange={(e) => onChange({ categoryId: e.target.value as CollectForm["categoryId"] })}>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </SelectField>
          <SelectField label="몇 개 찾을까요">
            <select className={bigSelectClass} value={form.topN} disabled={locked} onChange={(e) => onChange({ topN: Number(e.target.value) })}>
              {TOP_N_OPTIONS.map((count) => (
                <option key={count} value={count}>
                  리뷰 많은 순 상위 {count}개
                </option>
              ))}
            </select>
          </SelectField>
        </div>
      </Question>
      <Question n="질문 2" title="어떤 리뷰를 가져올까요?" hint="불만을 보려면 낮은 별점이 좋아요. 여러 개 골라도 돼요.">
        <div className="flex flex-wrap items-center gap-2">
          {STAR_OPTIONS.map((star) => {
            const on = form.stars.includes(star);
            return (
              <button
                key={star}
                type="button"
                aria-pressed={on}
                disabled={locked}
                onClick={() => toggleStar(star)}
                className={cn(
                  "h-10 min-w-16 rounded-full border px-3.5 text-sm disabled:opacity-50",
                  on ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-muted",
                )}
              >
                {star}점
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <SelectField label="별점마다 새로 몇 건">
            <select className={bigSelectClass} value={form.limit} disabled={locked} onChange={(e) => onChange({ limit: Number(e.target.value) })}>
              {REVIEW_LIMITS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </SelectField>
        </div>
      </Question>
    </div>
  );
}
