import type { HistoryEntry } from "../../domain/history/HistoryEntry.ts";
import type { ReadlineState } from "./readline.ts";
import { wrapPrompt } from "../../shared/utils/wrapPrompt.ts";

export type HistoryRecallDirection = "up" | "down";

export type HistoryRecallState = {
  historyCursor: number;
  stashedPrompt: ReadlineState | null;
};

export type HistoryRecallDecision =
  | { kind: "skip" }
  | { kind: "noop" }
  | {
      kind: "apply";
      prompt: ReadlineState;
      nextHistoryCursor: number;
      nextStashedPrompt: ReadlineState | null;
    };

export type HistoryRecallInput = HistoryRecallState & {
  text: string;
  cursor: number;
  viewportColumns: number;
  entries: readonly HistoryEntry[];
  direction: HistoryRecallDirection;
};

export function recallHistory(
  input: HistoryRecallInput,
): HistoryRecallDecision {
  const {
    text,
    cursor,
    viewportColumns,
    entries,
    historyCursor,
    stashedPrompt,
    direction,
  } = input;
  const wrap = wrapPrompt({ text, viewportColumns });
  const { row } = wrap.cursorToPosition(cursor);
  const lastRow = wrap.rows.length - 1;
  const atUpBoundary = row === 0;
  const atDownBoundary = row === lastRow;

  if (direction === "up") {
    if (!atUpBoundary) return { kind: "skip" };
    const target = entries[historyCursor];
    if (target === undefined) return { kind: "noop" };
    return {
      kind: "apply",
      prompt: { text: target.sql, cursor: target.sql.length },
      nextHistoryCursor: historyCursor + 1,
      nextStashedPrompt: historyCursor === 0 ? { text, cursor } : stashedPrompt,
    };
  }

  if (!atDownBoundary) return { kind: "skip" };
  if (historyCursor === 0) return { kind: "noop" };
  if (historyCursor === 1) {
    if (stashedPrompt === null) return { kind: "noop" };
    return {
      kind: "apply",
      prompt: stashedPrompt,
      nextHistoryCursor: 0,
      nextStashedPrompt: null,
    };
  }
  const target = entries[historyCursor - 2];
  if (target === undefined) return { kind: "noop" };
  return {
    kind: "apply",
    prompt: { text: target.sql, cursor: target.sql.length },
    nextHistoryCursor: historyCursor - 1,
    nextStashedPrompt: stashedPrompt,
  };
}
