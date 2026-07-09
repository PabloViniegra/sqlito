import stringWidth from "string-width";
import type { PastQuery } from "./appReducer.ts";

export const COLLAPSED_CARD_LINES = 1;
const INDICATOR_LINES = 1;
// header + rule + 4-line table frame + footer + rule: smallest useful full card
const EXPANDED_MIN_LINES = 8;

export type ResultsLayout = {
  readonly hiddenAbove: number;
  readonly collapsed: readonly PastQuery[];
  readonly expanded: PastQuery | null;
  readonly expandedMaxLines: number;
  readonly showIndicator: boolean;
};

/**
 * Splits a line budget across the visible past queries: the bottom-most
 * (newest at scroll offset 0) expands, the rest collapse to one line each,
 * and the oldest collapsed entries are dropped into the overflow indicator
 * until everything fits.
 */
export function layoutResults(
  visible: readonly PastQuery[],
  overflowAbove: number,
  budgetLines: number,
): ResultsLayout {
  const expanded = visible.length === 0 ? null : visible[visible.length - 1]!;
  if (expanded === null || budgetLines < 1) {
    return {
      hiddenAbove: overflowAbove + visible.length,
      collapsed: [],
      expanded: null,
      expandedMaxLines: 0,
      showIndicator: false,
    };
  }

  let collapsed = visible.slice(0, -1);
  let hiddenAbove = overflowAbove;
  const overhead = (): number =>
    collapsed.length * COLLAPSED_CARD_LINES +
    (hiddenAbove > 0 ? INDICATOR_LINES : 0);
  while (
    collapsed.length > 0 &&
    overhead() + EXPANDED_MIN_LINES > budgetLines
  ) {
    collapsed = collapsed.slice(1);
    hiddenAbove += 1;
  }

  const showIndicator = hiddenAbove > 0 && budgetLines >= INDICATOR_LINES + 1;
  const used =
    collapsed.length * COLLAPSED_CARD_LINES +
    (showIndicator ? INDICATOR_LINES : 0);
  return {
    hiddenAbove,
    collapsed,
    expanded,
    expandedMaxLines: Math.max(1, budgetLines - used),
    showIndicator,
  };
}

/** physical terminal lines a text occupies at a given width (\n-aware) */
export function countWrappedLines(text: string, width: number): number {
  const w = Math.max(1, width);
  return text
    .split("\n")
    .reduce(
      (acc, seg) => acc + Math.max(1, Math.ceil(stringWidth(seg) / w)),
      0,
    );
}
