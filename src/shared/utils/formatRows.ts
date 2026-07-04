import stringWidth from 'string-width';
import type { Column } from '../../domain/sql/Column.ts';

const CELL_GAP = '  ';

export function formatRows(
  columns: readonly Column[],
  rows: readonly unknown[][],
): string[] {
  if (columns.length === 0) return [];

  const widths = computeWidths(columns, rows);
  const header = renderHeader(columns, widths);
  const separator = renderSeparator(widths);
  const body = rows.map((row) => renderRow(row, widths));

  return [header, separator, ...body];
}

function computeWidths(
  columns: readonly Column[],
  rows: readonly unknown[][],
): number[] {
  const widths = columns.map((c) => stringWidth(c.name));
  for (const row of rows) {
    columns.forEach((_, i) => {
      const w = stringWidth(cellText(row[i]));
      if (w > widths[i]) widths[i] = w;
    });
  }
  return widths;
}

function renderHeader(columns: readonly Column[], widths: number[]): string {
  return columns.map((c, i) => c.name.padEnd(widths[i])).join(CELL_GAP);
}

function renderSeparator(widths: number[]): string {
  return widths.map((w) => '-'.repeat(w)).join(CELL_GAP);
}

function renderRow(row: readonly unknown[], widths: number[]): string {
  return columns(row).map((cell, i) => cell.padEnd(widths[i])).join(CELL_GAP);
}

function columns(row: readonly unknown[]): string[] {
  return row.map(cellText);
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'bigint') return value.toString();
  return String(value);
}