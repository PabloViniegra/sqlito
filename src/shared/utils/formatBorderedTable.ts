import stringWidth from "string-width";
import type { Column } from "../../domain/sql/Column.ts";
import { formatCell, truncateCell } from "./formatCell.ts";
import { computeColumnWidths } from "./measureColumn.ts";

const CELL_PADDING = 1;

export function formatBorderedTable(
  columns: readonly Column[],
  rows: readonly unknown[][],
  terminalWidth: number = 80,
): string[] {
  if (columns.length === 0) return [];

  const bordersBudget = 2;
  const paddingBudget = CELL_PADDING * 2 * columns.length;
  const innerBudget = Math.max(
    0,
    terminalWidth - bordersBudget - paddingBudget,
  );

  const widths = computeColumnWidths(columns, rows, innerBudget);

  const renderCell = (text: string, width: number): string =>
    " ".repeat(CELL_PADDING) +
    padVisible(text, width) +
    " ".repeat(CELL_PADDING);

  const topBorder =
    "╭" + widths.map((w) => "─".repeat(w + CELL_PADDING * 2)).join("┬") + "╮";
  const sepBorder =
    "├" + widths.map((w) => "─".repeat(w + CELL_PADDING * 2)).join("┼") + "┤";
  const botBorder =
    "╰" + widths.map((w) => "─".repeat(w + CELL_PADDING * 2)).join("┴") + "╯";

  const headerRow =
    "│" + columns.map((c, i) => renderCell(c.name, widths[i]!)).join("│") + "│";

  const bodyRows = rows.map(
    (row) =>
      "│" +
      row
        .map((cell, i) =>
          renderCell(truncateCell(formatCell(cell), widths[i]!), widths[i]!),
        )
        .join("│") +
      "│",
  );

  return [topBorder, headerRow, sepBorder, ...bodyRows, botBorder];
}

function padVisible(text: string, width: number): string {
  const padding = Math.max(0, width - stringWidth(text));
  return text + " ".repeat(padding);
}
