import stringWidth from "string-width";
import type { Column } from "../../domain/sql/Column.ts";
import { formatCell } from "./formatCell.ts";

export const MIN_COL_WIDTH = 4;

/**
 * Distributes a pure content budget (no borders, padding or gaps — the
 * caller owns all chrome) across columns.
 */
export function computeColumnWidths(
  columns: readonly Column[],
  rows: readonly unknown[][],
  contentBudget: number,
): number[] {
  if (columns.length === 0) return [];

  const desired = columns.map((col, i) => {
    const headerWidth = stringWidth(col.name);
    let valueWidth = 0;
    for (const row of rows) {
      const w = stringWidth(formatCell(row[i]));
      if (w > valueWidth) valueWidth = w;
    }
    return Math.max(headerWidth, valueWidth);
  });

  const available = Math.max(columns.length, contentBudget);
  const sumDesired = desired.reduce((a, b) => a + b, 0);
  if (sumDesired <= available) return desired;

  // every column keeps a readable floor; leftover goes proportionally to the hungriest
  const floorWidth = Math.min(
    MIN_COL_WIDTH,
    Math.floor(available / columns.length),
  );
  const base = desired.map((d) => Math.min(d, floorWidth));
  const leftover = available - base.reduce((a, b) => a + b, 0);
  const excess = desired.map((d, i) => d - base[i]!);
  const sumExcess = excess.reduce((a, b) => a + b, 0);
  const widths = base.map((b, i) =>
    sumExcess === 0 ? b : b + Math.floor((excess[i]! * leftover) / sumExcess),
  );

  let used = widths.reduce((a, b) => a + b, 0);
  const order = [...desired.keys()].sort((a, b) => desired[b]! - desired[a]!);
  while (used < available) {
    let grew = false;
    for (const i of order) {
      if (used >= available) break;
      if (widths[i]! < desired[i]!) {
        widths[i]! += 1;
        used += 1;
        grew = true;
      }
    }
    if (!grew) break;
  }

  return widths;
}
