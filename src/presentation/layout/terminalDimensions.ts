export function normalizeTerminalColumns(columns: number): number {
  if (!Number.isFinite(columns)) return 1;
  return Math.max(1, Math.floor(columns));
}

export function normalizeTerminalRows(rows: number): number {
  if (!Number.isFinite(rows)) return 1;
  return Math.max(1, Math.floor(rows));
}

export function normalizeLayoutLines(lines: number): number {
  if (lines === Number.POSITIVE_INFINITY) return lines;
  if (!Number.isFinite(lines)) return 0;
  return Math.max(0, Math.floor(lines));
}
