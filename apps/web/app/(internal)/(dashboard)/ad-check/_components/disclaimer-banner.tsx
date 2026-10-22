import { DISCLAIMER, SAMPLE_NOTICE } from "../_lib/display";

// 스크롤해도 보이도록 상단에 고정한다 (CLAUDE.md 7장 5번)
export function DisclaimerBanner() {
  return (
    <div
      role="note"
      className="sticky top-0 z-10 mb-6 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900"
    >
      <span>
        <span aria-hidden>⚠ </span>
        {DISCLAIMER}
      </span>
      <span className="text-xs">{SAMPLE_NOTICE}</span>
    </div>
  );
}
