import { normalizeTerminalColumns } from "./terminalDimensions.ts";

export const HEADER_LINES = 6;
export const FULL_HEADER_MIN_COLUMNS = 50;
export const COMPACT_HEADER_LINES = 3;

export function headerLines(columns: number): number {
  const width = normalizeTerminalColumns(columns);
  if (width < 6) return 1;
  return width >= FULL_HEADER_MIN_COLUMNS ? HEADER_LINES : COMPACT_HEADER_LINES;
}
