import { wrapPrompt } from "../../shared/utils/wrapPrompt.ts";
import { truncateCell } from "../../shared/utils/formatCell.ts";
import type { ReadlineState } from "../app/readline.ts";
import stringWidth from "string-width";

export const DEFAULT_PROMPT_PREFIX = "> ";

export function promptPrefixForViewport(
  prefix: string,
  viewportColumns: number,
): string {
  return truncateCell(prefix, Math.max(0, viewportColumns - 1));
}

export function promptEffectiveWidth(
  viewportColumns: number,
  prefixLength: number,
): number {
  return Math.max(1, viewportColumns - prefixLength);
}

export type PromptLayout = {
  rows: readonly string[];
  cursor: { row: number; col: number };
};

export function derivePromptLayout(
  readline: ReadlineState,
  viewportColumns: number,
): PromptLayout {
  const wrap = wrapPrompt({
    text: readline.text,
    viewportColumns,
  });
  return {
    rows: wrap.rows,
    cursor: wrap.cursorToPosition(readline.cursor),
  };
}

export function promptLineCount(
  layout: PromptLayout,
  viewportColumns: number,
  prefix: string,
): number {
  const cursorRow = layout.rows[layout.cursor.row] ?? "";
  const cursorLineWidth =
    stringWidth(cursorRow) +
    1 +
    (layout.cursor.row === 0 ? stringWidth(prefix) : 0);
  return layout.rows.length + (cursorLineWidth > viewportColumns ? 1 : 0);
}
