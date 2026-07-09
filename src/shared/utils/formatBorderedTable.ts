import stringWidth from "string-width";
import type { Column } from "../../domain/sql/Column.ts";
import { formatCell, truncateCell } from "./formatCell.ts";
import { computeColumnWidths, MIN_COL_WIDTH } from "./measureColumn.ts";

const CELL_PADDING = 1;

export type BorderedTable = {
  lines: string[];
  hiddenColumns: number;
};

// rendered line width = sum(widths) + chrome: cols+1 pipes and 2 padding spaces per col
const chromeWidth = (cols: number): number => 3 * cols + 1;

export function formatBorderedTable(
  columns: readonly Column[],
  rows: readonly unknown[][],
  terminalWidth: number = 80,
): BorderedTable {
  if (columns.length === 0) return { lines: [], hiddenColumns: 0 };

  // only render the columns that fit at MIN_COL_WIDTH; the rest are reported, not squeezed to 0
  const maxFit = Math.floor((terminalWidth - 1) / (MIN_COL_WIDTH + 3));
  const visibleCount = Math.max(1, Math.min(columns.length, maxFit));
  const hiddenColumns = columns.length - visibleCount;
  const visibleColumns = columns.slice(0, visibleCount);
  const visibleRows =
    hiddenColumns > 0 ? rows.map((row) => row.slice(0, visibleCount)) : rows;

  const contentBudget = Math.max(1, terminalWidth - chromeWidth(visibleCount));
  const widths = computeColumnWidths(
    visibleColumns,
    visibleRows,
    contentBudget,
  );

  const renderCell = (text: string, width: number): string =>
    " ".repeat(CELL_PADDING) +
    padVisible(truncateCell(text, width), width) +
    " ".repeat(CELL_PADDING);

  const border =
    "+" + widths.map((w) => "-".repeat(w + CELL_PADDING * 2)).join("+") + "+";

  const headerRow =
    "|" +
    visibleColumns.map((c, i) => renderCell(c.name, widths[i]!)).join("|") +
    "|";

  const bodyRows = visibleRows.map(
    (row) =>
      "|" +
      row.map((cell, i) => renderCell(formatCell(cell), widths[i]!)).join("|") +
      "|",
  );

  return {
    lines: [border, headerRow, border, ...bodyRows, border],
    hiddenColumns,
  };
}

function padVisible(text: string, width: number): string {
  const padding = Math.max(0, width - stringWidth(text));
  return text + " ".repeat(padding);
}
