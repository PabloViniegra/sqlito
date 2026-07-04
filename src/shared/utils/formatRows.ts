import stringWidth from "string-width";
import type { Column } from "../../domain/sql/Column.ts";
import { formatCell, truncateCell } from "./formatCell.ts";
import { computeColumnWidths } from "./measureColumn.ts";

const CELL_GAP = "  ";

export function formatRows(
  columns: readonly Column[],
  rows: readonly unknown[][],
  terminalWidth: number = 80,
): string[] {
  if (columns.length === 0) return [];

  const widths = computeColumnWidths(columns, rows, terminalWidth);
  const header = renderHeader(columns, widths);
  const separator = renderSeparator(widths);
  const body = rows.map((row) => renderRow(row, widths));

  return [header, separator, ...body];
}

function renderHeader(columns: readonly Column[], widths: number[]): string {
  return columns.map((c, i) => padVisible(c.name, widths[i]!)).join(CELL_GAP);
}

function renderSeparator(widths: number[]): string {
  return widths.map((w) => "-".repeat(w)).join(CELL_GAP);
}

function renderRow(row: readonly unknown[], widths: number[]): string {
  return row
    .map((cell, i) =>
      padVisible(truncateCell(formatCell(cell), widths[i]!), widths[i]!),
    )
    .join(CELL_GAP);
}

function padVisible(text: string, width: number): string {
  const padding = Math.max(0, width - stringWidth(text));
  return text + " ".repeat(padding);
}
