import { wrapPrompt } from "../../shared/utils/wrapPrompt.ts";
import type { ReadlineState } from "../app/readline.ts";

export const DEFAULT_PROMPT_PREFIX = "> ";

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
