import { wrapPrompt } from "../../shared/utils/wrapPrompt.ts";

export type ReadlineState = {
  text: string;
  cursor: number;
};

export type ReadlineIntent =
  | { type: "Insert"; ch: string }
  | { type: "Backspace" }
  | { type: "Delete" }
  | { type: "MoveLeft" }
  | { type: "MoveRight" }
  | { type: "MoveHome" }
  | { type: "MoveEnd" }
  | { type: "MoveUp"; viewportColumns: number }
  | { type: "MoveDown"; viewportColumns: number }
  | { type: "Reset"; text: string }
  | { type: "Paste"; text: string };

export function readlineReducer(
  state: ReadlineState,
  intent: ReadlineIntent,
): ReadlineState {
  switch (intent.type) {
    case "Insert":
      return {
        text:
          state.text.slice(0, state.cursor) +
          intent.ch +
          state.text.slice(state.cursor),
        cursor: state.cursor + intent.ch.length,
      };
    case "Backspace":
      if (state.cursor === 0) return state;
      return {
        text:
          state.text.slice(0, state.cursor - 1) +
          state.text.slice(state.cursor),
        cursor: state.cursor - 1,
      };
    case "Delete":
      if (state.cursor >= state.text.length) return state;
      return {
        text:
          state.text.slice(0, state.cursor) +
          state.text.slice(state.cursor + 1),
        cursor: state.cursor,
      };
    case "MoveLeft":
      if (state.cursor === 0) return state;
      return { ...state, cursor: state.cursor - 1 };
    case "MoveRight":
      if (state.cursor >= state.text.length) return state;
      return { ...state, cursor: state.cursor + 1 };
    case "MoveHome":
      if (state.cursor === 0) return state;
      return { ...state, cursor: 0 };
    case "MoveEnd":
      if (state.cursor === state.text.length) return state;
      return { ...state, cursor: state.text.length };
    case "MoveUp": {
      const wrap = wrapPrompt({
        text: state.text,
        viewportColumns: intent.viewportColumns,
      });
      const { row, col } = wrap.cursorToPosition(state.cursor);
      if (row === 0) return state;
      const destRow = row - 1;
      const destRowLen = wrap.rows[destRow]?.length ?? 0;
      const clampedCol = Math.min(col, destRowLen);
      return { ...state, cursor: wrap.positionToCursor(destRow, clampedCol) };
    }
    case "MoveDown": {
      const wrap = wrapPrompt({
        text: state.text,
        viewportColumns: intent.viewportColumns,
      });
      const { row, col } = wrap.cursorToPosition(state.cursor);
      const lastRow = wrap.rows.length - 1;
      if (row >= lastRow) return state;
      const destRow = row + 1;
      const destRowLen = wrap.rows[destRow]?.length ?? 0;
      const clampedCol = Math.min(col, destRowLen);
      return { ...state, cursor: wrap.positionToCursor(destRow, clampedCol) };
    }
    case "Reset":
      return { text: intent.text, cursor: intent.text.length };
    case "Paste":
      if (intent.text === "") return state;
      return {
        text:
          state.text.slice(0, state.cursor) +
          intent.text +
          state.text.slice(state.cursor),
        cursor: state.cursor + intent.text.length,
      };
    default: {
      const _exhaustive: never = intent;
      return _exhaustive;
    }
  }
}
