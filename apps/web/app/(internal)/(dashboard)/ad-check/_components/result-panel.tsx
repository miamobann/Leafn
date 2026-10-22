import { ActionBadge } from "./badges";
import { LineResultCard } from "./line-result-card";
import { ACTION_DISPLAY } from "../_lib/display";
import { countByAction, overallAction } from "../_lib/judge";
import { ACTIONS, type LineResult } from "../_lib/types";

type ResultPanelProps = {
  lines: LineResult[];
  selectedProductId: string;
  productNames: Record<string, string>;
  selected: Record<number, string>;
  onSelect: (lineIndex: number, text: string | null) => void;
};

export function ResultPanel({ lines, selectedProductId, productNames, selected, onSelect }: ResultPanelProps) {
  const counts = countByAction(lines);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-4">
        <span className="text-sm font-semibold">전체 판정</span>
        <ActionBadge action={overallAction(lines)} />
        <span className="text-sm text-muted">총 {lines.length}줄</span>
        <ul className="flex flex-wrap gap-3 text-sm">
          {ACTIONS.map((action) => (
            <li key={action}>
              <span aria-hidden>{ACTION_DISPLAY[action].icon} </span>
              {ACTION_DISPLAY[action].label} {counts[action]}
            </li>
          ))}
        </ul>
      </div>

      {lines.map((line) => (
        <LineResultCard
          key={line.lineIndex}
          line={line}
          mismatchProductName={
            line.sampleProductId && line.sampleProductId !== selectedProductId
              ? productNames[line.sampleProductId]
              : null
          }
          selectedSuggestion={selected[line.lineIndex] ?? null}
          onSelect={(text) => onSelect(line.lineIndex, text)}
        />
      ))}
    </div>
  );
}
