import { describe, expect, it } from "vitest";
import { readlineReducer, type ReadlineState } from "./readline.ts";

describe("readlineReducer", () => {
  it("Insert at end of text appends the character and advances the cursor", () => {
    const state: ReadlineState = { text: "ab", cursor: 2 };
    const next = readlineReducer(state, { type: "Insert", ch: "c" });

    expect(next).toEqual({ text: "abc", cursor: 3 });
  });

  it("Insert at the start of text prepends before the cursor", () => {
    const state: ReadlineState = { text: "bc", cursor: 0 };
    const next = readlineReducer(state, { type: "Insert", ch: "a" });

    expect(next).toEqual({ text: "abc", cursor: 1 });
  });

  it("Insert in the middle of text splits and the cursor sits after the inserted char", () => {
    const state: ReadlineState = { text: "ac", cursor: 1 };
    const next = readlineReducer(state, { type: "Insert", ch: "b" });

    expect(next).toEqual({ text: "abc", cursor: 2 });
  });

  it("Backspace at the end of text removes the last character and pulls the cursor back", () => {
    const state: ReadlineState = { text: "abc", cursor: 3 };
    const next = readlineReducer(state, { type: "Backspace" });

    expect(next).toEqual({ text: "ab", cursor: 2 });
  });

  it("Backspace in the middle of text removes the char before the cursor", () => {
    const state: ReadlineState = { text: "abc", cursor: 2 };
    const next = readlineReducer(state, { type: "Backspace" });

    expect(next).toEqual({ text: "ac", cursor: 1 });
  });

  it("Backspace on an empty prompt is a no-op", () => {
    const state: ReadlineState = { text: "", cursor: 0 };
    const next = readlineReducer(state, { type: "Backspace" });

    expect(next).toEqual({ text: "", cursor: 0 });
  });

  it("Delete in the middle of text removes the char at the cursor without moving it", () => {
    const state: ReadlineState = { text: "abc", cursor: 1 };
    const next = readlineReducer(state, { type: "Delete" });

    expect(next).toEqual({ text: "ac", cursor: 1 });
  });

  it("Delete at the end of text is a no-op", () => {
    const state: ReadlineState = { text: "abc", cursor: 3 };
    const next = readlineReducer(state, { type: "Delete" });

    expect(next).toEqual({ text: "abc", cursor: 3 });
  });

  it("Delete on an empty prompt is a no-op", () => {
    const state: ReadlineState = { text: "", cursor: 0 };
    const next = readlineReducer(state, { type: "Delete" });

    expect(next).toEqual({ text: "", cursor: 0 });
  });

  it("MoveLeft in the middle of text pulls the cursor back by one", () => {
    const state: ReadlineState = { text: "abc", cursor: 2 };
    const next = readlineReducer(state, { type: "MoveLeft" });

    expect(next).toEqual({ text: "abc", cursor: 1 });
  });

  it("MoveLeft at the start of text is a no-op (clamped at 0)", () => {
    const state: ReadlineState = { text: "abc", cursor: 0 };
    const next = readlineReducer(state, { type: "MoveLeft" });

    expect(next).toEqual({ text: "abc", cursor: 0 });
  });

  it("MoveRight in the middle of text advances the cursor by one", () => {
    const state: ReadlineState = { text: "abc", cursor: 1 };
    const next = readlineReducer(state, { type: "MoveRight" });

    expect(next).toEqual({ text: "abc", cursor: 2 });
  });

  it("MoveRight at the end of text is a no-op (clamped at text.length)", () => {
    const state: ReadlineState = { text: "abc", cursor: 3 };
    const next = readlineReducer(state, { type: "MoveRight" });

    expect(next).toEqual({ text: "abc", cursor: 3 });
  });

  it("MoveHome jumps the cursor to the start of the text", () => {
    const state: ReadlineState = { text: "abc", cursor: 2 };
    const next = readlineReducer(state, { type: "MoveHome" });

    expect(next).toEqual({ text: "abc", cursor: 0 });
  });

  it("MoveHome on an empty prompt is a no-op", () => {
    const state: ReadlineState = { text: "", cursor: 0 };
    const next = readlineReducer(state, { type: "MoveHome" });

    expect(next).toEqual({ text: "", cursor: 0 });
  });

  it("MoveEnd jumps the cursor to the end of the text", () => {
    const state: ReadlineState = { text: "abc", cursor: 1 };
    const next = readlineReducer(state, { type: "MoveEnd" });

    expect(next).toEqual({ text: "abc", cursor: 3 });
  });

  it("Reset replaces the text and parks the cursor at the end of the replacement", () => {
    const state: ReadlineState = { text: "old", cursor: 2 };
    const next = readlineReducer(state, { type: "Reset", text: "SELECT 1" });

    expect(next).toEqual({ text: "SELECT 1", cursor: 8 });
  });

  it("Reset with the same string still parks the cursor (used by history recall)", () => {
    const state: ReadlineState = { text: "SELECT 1", cursor: 0 };
    const next = readlineReducer(state, { type: "Reset", text: "SELECT 1" });

    expect(next).toEqual({ text: "SELECT 1", cursor: 8 });
  });

  it("Reset with an explicit cursor parks at that cursor (slice-6 stash restore)", () => {
    const state: ReadlineState = { text: "old", cursor: 3 };
    const next = readlineReducer(state, {
      type: "Reset",
      text: "SELECT typed",
      cursor: 4,
    });

    expect(next).toEqual({ text: "SELECT typed", cursor: 4 });
  });

  it("Reset with an explicit cursor of 0 puts the caret at the start", () => {
    const state: ReadlineState = { text: "old", cursor: 3 };
    const next = readlineReducer(state, {
      type: "Reset",
      text: "SELECT typed",
      cursor: 0,
    });

    expect(next).toEqual({ text: "SELECT typed", cursor: 0 });
  });

  it("Reset with an explicit cursor clamps out-of-range to text.length", () => {
    const state: ReadlineState = { text: "old", cursor: 3 };
    const next = readlineReducer(state, {
      type: "Reset",
      text: "abc",
      cursor: 99,
    });

    expect(next).toEqual({ text: "abc", cursor: 3 });
  });

  it("Paste inserts the payload at the cursor and advances past it", () => {
    const state: ReadlineState = { text: "ab", cursor: 1 };
    const next = readlineReducer(state, { type: "Paste", text: "XY" });

    expect(next).toEqual({ text: "aXYb", cursor: 3 });
  });

  it("Paste at the start prepends the payload", () => {
    const state: ReadlineState = { text: "yz", cursor: 0 };
    const next = readlineReducer(state, { type: "Paste", text: "ab" });

    expect(next).toEqual({ text: "abyz", cursor: 2 });
  });

  it("Paste with an empty payload is a no-op", () => {
    const state: ReadlineState = { text: "ab", cursor: 1 };
    const next = readlineReducer(state, { type: "Paste", text: "" });

    expect(next).toEqual({ text: "ab", cursor: 1 });
  });

  it("returns a brand-new state and does not mutate the input", () => {
    const state: ReadlineState = { text: "abc", cursor: 1 };
    const snapshot = { text: state.text, cursor: state.cursor };
    readlineReducer(state, { type: "Insert", ch: "X" });

    expect(state).toEqual(snapshot);
  });

  it("MoveUp from a non-first row preserves the column on the destination row", () => {
    const state: ReadlineState = { text: "ABCDEFGHIJ", cursor: 9 };
    const next = readlineReducer(state, {
      type: "MoveUp",
      viewportColumns: 4,
    });

    expect(next).toEqual({ text: "ABCDEFGHIJ", cursor: 5 });
  });

  it("MoveUp at the first row is a no-op", () => {
    const state: ReadlineState = { text: "ABCDE", cursor: 2 };
    const next = readlineReducer(state, {
      type: "MoveUp",
      viewportColumns: 4,
    });

    expect(next).toEqual({ text: "ABCDE", cursor: 2 });
  });

  it("MoveUp on an empty prompt is a no-op", () => {
    const state: ReadlineState = { text: "", cursor: 0 };
    const next = readlineReducer(state, {
      type: "MoveUp",
      viewportColumns: 4,
    });

    expect(next).toEqual({ text: "", cursor: 0 });
  });

  it("MoveDown from a non-last row preserves the column on the destination row", () => {
    const state: ReadlineState = { text: "ABCDEFGHIJ", cursor: 0 };
    const next = readlineReducer(state, {
      type: "MoveDown",
      viewportColumns: 4,
    });

    expect(next).toEqual({ text: "ABCDEFGHIJ", cursor: 4 });
  });

  it("MoveDown clamps the column when the destination row is shorter", () => {
    const state: ReadlineState = { text: "ABCDEFGHIJ", cursor: 7 };
    const next = readlineReducer(state, {
      type: "MoveDown",
      viewportColumns: 4,
    });

    expect(next).toEqual({ text: "ABCDEFGHIJ", cursor: 10 });
  });

  it("MoveDown at the last row is a no-op", () => {
    const state: ReadlineState = { text: "ABCDEFGHIJ", cursor: 10 };
    const next = readlineReducer(state, {
      type: "MoveDown",
      viewportColumns: 4,
    });

    expect(next).toEqual({ text: "ABCDEFGHIJ", cursor: 10 });
  });

  it("MoveDown on an empty prompt is a no-op", () => {
    const state: ReadlineState = { text: "", cursor: 0 };
    const next = readlineReducer(state, {
      type: "MoveDown",
      viewportColumns: 4,
    });

    expect(next).toEqual({ text: "", cursor: 0 });
  });

  it("KillWord removes the word behind the cursor and parks the cursor at the boundary", () => {
    const state: ReadlineState = { text: "SELECT * FROM", cursor: 13 };
    const next = readlineReducer(state, { type: "KillWord" });

    expect(next).toEqual({ text: "SELECT * ", cursor: 9 });
  });

  it("KillWord at the start of text is a no-op", () => {
    const state: ReadlineState = { text: "abc def", cursor: 0 };
    const next = readlineReducer(state, { type: "KillWord" });

    expect(next).toEqual({ text: "abc def", cursor: 0 });
  });

  it("KillWord on an empty prompt is a no-op", () => {
    const state: ReadlineState = { text: "", cursor: 0 };
    const next = readlineReducer(state, { type: "KillWord" });

    expect(next).toEqual({ text: "", cursor: 0 });
  });

  it("KillWord at the start of a word kills the previous word and parks the cursor at its start", () => {
    const state: ReadlineState = { text: "abc def", cursor: 4 };
    const next = readlineReducer(state, { type: "KillWord" });

    expect(next).toEqual({ text: "def", cursor: 0 });
  });

  it("KillToStart drops everything before the cursor and parks it at 0", () => {
    const state: ReadlineState = { text: "SELECT * FROM", cursor: 9 };
    const next = readlineReducer(state, { type: "KillToStart" });

    expect(next).toEqual({ text: "FROM", cursor: 0 });
  });

  it("KillToStart at the start of text is a no-op", () => {
    const state: ReadlineState = { text: "abc", cursor: 0 };
    const next = readlineReducer(state, { type: "KillToStart" });

    expect(next).toEqual({ text: "abc", cursor: 0 });
  });

  it("KillToStart at the end of text clears the prompt", () => {
    const state: ReadlineState = { text: "abc", cursor: 3 };
    const next = readlineReducer(state, { type: "KillToStart" });

    expect(next).toEqual({ text: "", cursor: 0 });
  });

  it("KillToEnd drops everything after the cursor and leaves the cursor in place", () => {
    const state: ReadlineState = { text: "SELECT * FROM", cursor: 9 };
    const next = readlineReducer(state, { type: "KillToEnd" });

    expect(next).toEqual({ text: "SELECT * ", cursor: 9 });
  });

  it("KillToEnd at the end of text is a no-op", () => {
    const state: ReadlineState = { text: "abc", cursor: 3 };
    const next = readlineReducer(state, { type: "KillToEnd" });

    expect(next).toEqual({ text: "abc", cursor: 3 });
  });

  it("KillToEnd at the start of text clears the prompt", () => {
    const state: ReadlineState = { text: "abc", cursor: 0 };
    const next = readlineReducer(state, { type: "KillToEnd" });

    expect(next).toEqual({ text: "", cursor: 0 });
  });

  it("WordLeft jumps the cursor to the start of the previous word", () => {
    const state: ReadlineState = { text: "SELECT * FROM users", cursor: 18 };
    const next = readlineReducer(state, { type: "WordLeft" });

    expect(next).toEqual({ text: "SELECT * FROM users", cursor: 14 });
  });

  it("WordLeft at the start of text is a no-op", () => {
    const state: ReadlineState = { text: "abc def", cursor: 0 };
    const next = readlineReducer(state, { type: "WordLeft" });

    expect(next).toEqual({ text: "abc def", cursor: 0 });
  });

  it("WordLeft on an empty prompt is a no-op", () => {
    const state: ReadlineState = { text: "", cursor: 0 };
    const next = readlineReducer(state, { type: "WordLeft" });

    expect(next).toEqual({ text: "", cursor: 0 });
  });

  it("WordRight jumps the cursor to the end of the next word", () => {
    const state: ReadlineState = { text: "SELECT * FROM users", cursor: 0 };
    const next = readlineReducer(state, { type: "WordRight" });

    expect(next).toEqual({ text: "SELECT * FROM users", cursor: 6 });
  });

  it("WordRight at the end of text is a no-op", () => {
    const state: ReadlineState = { text: "abc def", cursor: 7 };
    const next = readlineReducer(state, { type: "WordRight" });

    expect(next).toEqual({ text: "abc def", cursor: 7 });
  });

  it("WordRight on an empty prompt is a no-op", () => {
    const state: ReadlineState = { text: "", cursor: 0 };
    const next = readlineReducer(state, { type: "WordRight" });

    expect(next).toEqual({ text: "", cursor: 0 });
  });

  it("does not mutate the input state across the new intents", () => {
    const snapshot: ReadlineState = { text: "abc def", cursor: 4 };
    const state: ReadlineState = {
      text: snapshot.text,
      cursor: snapshot.cursor,
    };
    readlineReducer(state, { type: "KillToStart" });
    readlineReducer(state, { type: "KillToEnd" });
    readlineReducer(state, { type: "KillWord" });
    readlineReducer(state, { type: "WordLeft" });
    readlineReducer(state, { type: "WordRight" });

    expect(state).toEqual(snapshot);
  });

  describe("codepoint-aware cursor movement (surrogate pairs)", () => {
    it("MoveRight steps over a surrogate pair as a single character", () => {
      const state: ReadlineState = { text: "a😀b", cursor: 1 };
      const next = readlineReducer(state, { type: "MoveRight" });

      expect(next).toEqual({ text: "a😀b", cursor: 3 });
    });

    it("MoveLeft steps back over a surrogate pair as a single character", () => {
      const state: ReadlineState = { text: "a😀b", cursor: 3 };
      const next = readlineReducer(state, { type: "MoveLeft" });

      expect(next).toEqual({ text: "a😀b", cursor: 1 });
    });

    it("Backspace removes a whole surrogate pair, not just one code unit", () => {
      const state: ReadlineState = { text: "a😀b", cursor: 3 };
      const next = readlineReducer(state, { type: "Backspace" });

      expect(next).toEqual({ text: "ab", cursor: 1 });
    });

    it("Delete removes a whole surrogate pair, not just one code unit", () => {
      const state: ReadlineState = { text: "a😀b", cursor: 1 };
      const next = readlineReducer(state, { type: "Delete" });

      expect(next).toEqual({ text: "ab", cursor: 1 });
    });
  });
});
