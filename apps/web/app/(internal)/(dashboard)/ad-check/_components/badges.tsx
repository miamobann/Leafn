import { ACTION_DISPLAY, STATUS_DISPLAY } from "../_lib/display";
import type { Action, InputLang, ReviewStatus } from "../_lib/types";

const BADGE_BASE = "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap";

export function ActionBadge({ action }: { action: Action }) {
  const tone = ACTION_DISPLAY[action];
  return (
    <span className={`${BADGE_BASE} ${tone.badge}`}>
      <span aria-hidden>{tone.icon}</span>
      {tone.label}
    </span>
  );
}

export function StatusBadge({ status }: { status: ReviewStatus }) {
  const tone = STATUS_DISPLAY[status];
  return (
    <span className={`${BADGE_BASE} ${tone.badge}`}>
      <span aria-hidden>{tone.icon}</span>
      {tone.label}
    </span>
  );
}

export function LangBadge({ lang }: { lang: InputLang }) {
  return (
    <span className={`${BADGE_BASE} border-border text-muted`}>{lang === "ko" ? "한국어 입력" : "일본어 입력"}</span>
  );
}
