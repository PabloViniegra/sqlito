import { normalizeLayoutLines } from "./terminalDimensions.ts";

export const MAX_VISIBLE_OVERLAY_ITEMS = 10;
export const OVERLAY_CHROME_LINES = {
  autocomplete: 4,
  commandPalette: 5,
} as const;

export function overlayLineCount(
  itemCount: number,
  chromeLines: number,
  maxLines: number,
): number {
  const availableLines = normalizeLayoutLines(maxLines);
  if (availableLines <= 0) return 0;
  const fullLines =
    chromeLines + Math.max(1, Math.min(MAX_VISIBLE_OVERLAY_ITEMS, itemCount));
  if (availableLines < chromeLines + 1) return 1;
  return Math.min(fullLines, availableLines);
}

export function overlayItemLimit(
  itemCount: number,
  chromeLines: number,
  maxLines: number,
): number {
  const availableLines = normalizeLayoutLines(maxLines);
  if (availableLines < chromeLines + 1) return 0;
  return Math.min(
    MAX_VISIBLE_OVERLAY_ITEMS,
    itemCount,
    availableLines - chromeLines,
  );
}
