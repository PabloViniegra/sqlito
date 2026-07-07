import type { ReadlineState } from "../app/readline.ts";

export type PromptLayout = {
  rows: readonly { text: string }[];
  cursor: { row: number; col: number };
};

export function derivePromptLayout(
  readline: ReadlineState,
  _viewportColumns: number,
): PromptLayout {
  return {
    rows: [{ text: readline.text }],
    cursor: { row: 0, col: readline.cursor },
  };
}
