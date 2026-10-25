// 수집 화면의 조건 선택 칸: 우리 제품(picker) · 플랫폼 · 제품 종류 · 경쟁 제품 수 · 가져올 별점 · 별점마다 새로 가져올 건수.
import type { ReactNode } from "react";
import { CATEGORIES, type CollectForm, REVIEW_LIMITS, STAR_OPTIONS, TEXT, TOP_N_OPTIONS } from "./collect-options";
import { Field, selectClass } from "./collect-parts";
import { IMPORT_PLATFORMS } from "./import-platforms";

export function Conditions({
  picker,
  form,
  shownStars,
  locked,
  onChange,
}: {
  picker: ReactNode;
  form: CollectForm;
  /** 체크박스에 보이는 별점. 요청이 있으면 그 요청의 별점이다 */
  shownStars: number[];
  locked: boolean;
  onChange: (patch: Partial<CollectForm>) => void;
}) {
  const toggleStar = (star: number) =>
    onChange({ stars: form.stars.includes(star) ? form.stars.filter((x) => x !== star) : [...form.stars, star].toSorted((a, b) => a - b) });
  return (
    <div className="grid grid-cols-2 items-end gap-3 text-sm sm:grid-cols-3">
      {picker}
      <Field label={TEXT.platform}>
        <select className={selectClass} value={form.platformId} disabled={locked} onChange={(e) => onChange({ platformId: e.target.value as CollectForm["platformId"] })}>
          {IMPORT_PLATFORMS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label={TEXT.category}>
        <select className={selectClass} value={form.categoryId} disabled={locked} onChange={(e) => onChange({ categoryId: e.target.value as CollectForm["categoryId"] })}>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label={TEXT.topN}>
        <select className={selectClass} value={form.topN} disabled={locked} onChange={(e) => onChange({ topN: Number(e.target.value) })}>
          {TOP_N_OPTIONS.map((count) => (
            <option key={count} value={count}>
              리뷰 많은 순 상위 {count}개
            </option>
          ))}
        </select>
      </Field>
      <Field label={TEXT.stars}>
        <div className="flex h-8 items-center gap-3">
          {STAR_OPTIONS.map((star) => (
            <label key={star} className="flex items-center gap-1">
              <input type="checkbox" className="size-4 accent-primary" checked={shownStars.includes(star)} disabled={locked} onChange={() => toggleStar(star)} />
              {star}점
            </label>
          ))}
        </div>
      </Field>
      <Field label={TEXT.limit}>
        <select className={selectClass} value={form.limit} disabled={locked} onChange={(e) => onChange({ limit: Number(e.target.value) })}>
          {REVIEW_LIMITS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}
