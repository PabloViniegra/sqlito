import stringWidth from "string-width";
import type { Column } from "../../domain/sql/Column.ts";
import { formatCell } from "./formatCell.ts";

const CELL_GAP = 2;

export function computeColumnWidths(
  columns: readonly Column[],
  rows: readonly unknown[][],
  terminalWidth: number,
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

  const totalGap = CELL_GAP * (columns.length - 1);
  const available = Math.max(0, terminalWidth - totalGap);
  const sumDesired = desired.reduce((a, b) => a + b, 0);

  if (sumDesired <= available) return desired;

  const scale = available / sumDesired;
  const widths = desired.map((d) => Math.floor(d * scale));

  let used = widths.reduce((a, b) => a + b, 0);
  const order = [...desired.keys()].sort((a, b) => desired[b]! - desired[a]!);

  while (used < available) {
    let grew = false;
    for (const i of order) {
      if (used >= available) break;
      widths[i]! += 1;
      used += 1;
      grew = true;
    }
    if (!grew) break;
  }

  return widths;
}
