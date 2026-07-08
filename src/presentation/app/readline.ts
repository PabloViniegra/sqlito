import { wrapPrompt } from "../../shared/utils/wrapPrompt.ts";
import { findWordLeft, findWordRight } from "./readline/wordBoundary.ts";

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
  | { type: "WordLeft" }
  | { type: "WordRight" }
  | { type: "KillToStart" }
  | { type: "KillToEnd" }
  | { type: "KillWord" }
  | { type: "Reset"; text: string; cursor?: number }
  | { type: "Paste"; text: string };

const HIGH_SURROGATE_MIN = 0xd800;
const HIGH_SURROGATE_MAX = 0xdbff;
const LOW_SURROGATE_MIN = 0xdc00;
const LOW_SURROGATE_MAX = 0xdfff;

function isHighSurrogate(code: number): boolean {
  return code >= HIGH_SURROGATE_MIN && code <= HIGH_SURROGATE_MAX;
}

function isLowSurrogate(code: number): boolean {
  return code >= LOW_SURROGATE_MIN && code <= LOW_SURROGATE_MAX;
}

// Steps one codepoint left/right instead of one UTF-16 code unit, so a
// surrogate pair (e.g. an emoji) moves and deletes as a single character.
function stepLeft(text: string, cursor: number): number {
  if (
    cursor >= 2 &&
    isLowSurrogate(text.charCodeAt(cursor - 1)) &&
    isHighSurrogate(text.charCodeAt(cursor - 2))
  ) {
    return cursor - 2;
  }
  return cursor - 1;
}

function stepRight(text: string, cursor: number): number {
  if (
    cursor + 1 < text.length &&
    isHighSurrogate(text.charCodeAt(cursor)) &&
    isLowSurrogate(text.charCodeAt(cursor + 1))
  ) {
    return cursor + 2;
  }
  return cursor + 1;
}

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
    case "Backspace": {
      if (state.cursor === 0) return state;
      const start = stepLeft(state.text, state.cursor);
      return {
        text: state.text.slice(0, start) + state.text.slice(state.cursor),
        cursor: start,
      };
    }
    case "Delete": {
      if (state.cursor >= state.text.length) return state;
      const end = stepRight(state.text, state.cursor);
      return {
        text: state.text.slice(0, state.cursor) + state.text.slice(end),
        cursor: state.cursor,
      };
    }
    case "MoveLeft":
      if (state.cursor === 0) return state;
      return { ...state, cursor: stepLeft(state.text, state.cursor) };
    case "MoveRight":
      if (state.cursor >= state.text.length) return state;
      return { ...state, cursor: stepRight(state.text, state.cursor) };
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
    case "WordLeft":
      return { ...state, cursor: findWordLeft(state.text, state.cursor) };
    case "WordRight":
      return { ...state, cursor: findWordRight(state.text, state.cursor) };
    case "KillToStart":
      if (state.cursor === 0) return state;
      return {
        text: state.text.slice(state.cursor),
        cursor: 0,
      };
    case "KillToEnd":
      if (state.cursor >= state.text.length) return state;
      return {
        text: state.text.slice(0, state.cursor),
        cursor: state.cursor,
      };
    case "KillWord": {
      const boundary = findWordLeft(state.text, state.cursor);
      if (boundary === state.cursor) return state;
      return {
        text: state.text.slice(0, boundary) + state.text.slice(state.cursor),
        cursor: boundary,
      };
    }
    case "Reset": {
      const raw = intent.cursor ?? intent.text.length;
      const cursor = Math.min(Math.max(0, raw), intent.text.length);
      return { text: intent.text, cursor };
    }
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
