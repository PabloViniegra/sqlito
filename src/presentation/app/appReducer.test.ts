import { describe, expect, it } from "vitest";
import type { HistoryEntry } from "../../domain/history/HistoryEntry.ts";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";
import { HIGH_CONTRAST_THEME } from "../../domain/theme/Theme.ts";
import type { ReadlineState } from "./readline.ts";
import { appReducer, initialState } from "./appReducer.ts";

function rl(text: string, cursor?: number): ReadlineState {
  return { text, cursor: cursor ?? text.length };
}

describe("appReducer", () => {
  describe("setPrompt", () => {
    it("updates state.prompt.text to the new value and parks the cursor at the end", () => {
      const next = appReducer(initialState, {
        type: "setPrompt",
        value: "SELECT 1",
      });

      expect(next.prompt).toEqual({ text: "SELECT 1", cursor: 8 });
    });
  });

  describe("backspace", () => {
    it("removes the last character from prompt", () => {
      const state = { ...initialState, prompt: rl("SELECT") };
      const next = appReducer(state, { type: "backspace" });

      expect(next.prompt.text).toBe("SELEC");
    });

    it("leaves an empty prompt empty", () => {
      const next = appReducer(initialState, { type: "backspace" });

      expect(next.prompt.text).toBe("");
    });
  });

  describe("submit", () => {
    const rowsOutcome: QueryOutcome = {
      kind: "rows",
      columns: [{ name: "a", type: null }],
      rows: [[1]],
    };

    it("clears the prompt", () => {
      const state = { ...initialState, prompt: rl("SELECT 1") };
      const next = appReducer(state, {
        type: "submit",
        outcome: rowsOutcome,
      });

      expect(next.prompt.text).toBe("");
    });

    it("is a no-op for prompt when prompt is empty (prompt stays empty)", () => {
      const next = appReducer(initialState, {
        type: "submit",
        outcome: rowsOutcome,
      });

      expect(next.prompt.text).toBe("");
    });

    it("clears statusMessage", () => {
      const state = {
        ...initialState,
        statusMessage: { text: "exported", kind: "info" as const },
      };
      const next = appReducer(state, {
        type: "submit",
        outcome: rowsOutcome,
      });

      expect(next.statusMessage).toBeNull();
    });

    it("stores lastRowsOutcome when the outcome is rows", () => {
      const state = { ...initialState, lastRowsOutcome: null };
      const next = appReducer(state, { type: "submit", outcome: rowsOutcome });

      expect(next.lastRowsOutcome).toBe(rowsOutcome);
    });

    it("clears lastRowsOutcome when the outcome is affected", () => {
      const state = { ...initialState, lastRowsOutcome: rowsOutcome };
      const next = appReducer(state, {
        type: "submit",
        outcome: { kind: "affected", changes: 1, lastInsertRowid: 1 },
      });

      expect(next.lastRowsOutcome).toBeNull();
    });

    it("clears lastRowsOutcome when the outcome is side-effect", () => {
      const state = { ...initialState, lastRowsOutcome: rowsOutcome };
      const next = appReducer(state, {
        type: "submit",
        outcome: { kind: "side-effect" },
      });

      expect(next.lastRowsOutcome).toBeNull();
    });

    it("clears lastRowsOutcome when the outcome is error", () => {
      const state = { ...initialState, lastRowsOutcome: rowsOutcome };
      const next = appReducer(state, {
        type: "submit",
        outcome: { kind: "error", message: "boom" },
      });

      expect(next.lastRowsOutcome).toBeNull();
    });
  });

  describe("setStatus", () => {
    it("sets an info status message", () => {
      const next = appReducer(initialState, {
        type: "setStatus",
        status: { text: "Exported 3 rows", kind: "info" },
      });

      expect(next.statusMessage).toEqual({
        text: "Exported 3 rows",
        kind: "info",
      });
    });

    it("sets an error status message", () => {
      const next = appReducer(initialState, {
        type: "setStatus",
        status: { text: "boom", kind: "error" },
      });

      expect(next.statusMessage).toEqual({ text: "boom", kind: "error" });
    });

    it("clears the status message when null", () => {
      const state = {
        ...initialState,
        statusMessage: { text: "old", kind: "info" as const },
      };
      const next = appReducer(state, { type: "setStatus", status: null });

      expect(next.statusMessage).toBeNull();
    });
  });

  describe("exit", () => {
    it("returns state unchanged (driver owns db.close + ink exit)", () => {
      const state = {
        ...initialState,
        prompt: rl("SELECT 1"),
        statusMessage: { text: "msg", kind: "info" as const },
      };
      const next = appReducer(state, { type: "exit" });

      expect(next).toBe(state);
    });
  });

  describe("readline (basic-key dispatch)", () => {
    it("typing 'SELECT 1' through Insert intents yields the same prompt as setPrompt", () => {
      const initial = initialState;
      const afterInserts = ["S", "E", "L", "E", "C", "T", " ", "1"].reduce(
        (s, ch) =>
          appReducer(s, { type: "readline", intent: { type: "Insert", ch } }),
        initial,
      );

      expect(afterInserts.prompt).toEqual({ text: "SELECT 1", cursor: 8 });

      const viaSetPrompt = appReducer(initialState, {
        type: "setPrompt",
        value: "SELECT 1",
      });

      expect(afterInserts.prompt).toEqual(viaSetPrompt.prompt);
    });

    it("cursor tracks the cursor position after a MoveRight in the middle", () => {
      const seeded = appReducer(initialState, {
        type: "setPrompt",
        value: "abc",
      });

      const afterMove = appReducer(seeded, {
        type: "readline",
        intent: { type: "MoveLeft" },
      });

      expect(afterMove.prompt).toEqual({ text: "abc", cursor: 2 });
    });

    it("regression: submitting a multi-character SQL still routes through ExecuteQuery unchanged", () => {
      const before = appReducer(initialState, {
        type: "setPrompt",
        value: "SELECT 1",
      });

      expect(before.prompt.text).toBe("SELECT 1");

      const after = appReducer(before, {
        type: "submit",
        outcome: {
          kind: "rows",
          columns: [{ name: "a", type: null }],
          rows: [[1]],
        },
      });

      expect(after.prompt.text).toBe("");
      expect(after.prompt.cursor).toBe(0);
    });
  });

  describe("openAutocomplete", () => {
    it("opens autocomplete with the given prefix and index 0", () => {
      const next = appReducer(initialState, {
        type: "openAutocomplete",
        prefix: "sel",
      });

      expect(next.autocomplete).toEqual({
        open: true,
        index: 0,
        prefix: "sel",
        prefixBase: undefined,
        context: {},
      });
    });

    it("replaces a previously open autocomplete and resets index", () => {
      const state = {
        ...initialState,
        autocomplete: {
          open: true,
          index: 3,
          prefix: "old",
          context: { precedingToken: "x" },
        },
      };
      const next = appReducer(state, {
        type: "openAutocomplete",
        prefix: "new",
      });

      expect(next.autocomplete).toEqual({
        open: true,
        index: 0,
        prefix: "new",
        prefixBase: undefined,
        context: {},
      });
    });

    it("opens with empty prefix when called with ''", () => {
      const next = appReducer(initialState, {
        type: "openAutocomplete",
        prefix: "",
      });

      expect(next.autocomplete?.prefix).toBe("");
    });

    it("opens with prefixBase and context when provided for column completion", () => {
      const next = appReducer(initialState, {
        type: "openAutocomplete",
        prefix: "",
        prefixBase: "u.",
        context: { referencedTable: "users" },
      });

      expect(next.autocomplete).toEqual({
        open: true,
        index: 0,
        prefix: "",
        prefixBase: "u.",
        context: { referencedTable: "users" },
      });
    });
  });

  describe("closeAutocomplete", () => {
    it("sets autocomplete to null", () => {
      const state = {
        ...initialState,
        autocomplete: { open: true, index: 2, prefix: "sel", context: {} },
      };
      const next = appReducer(state, { type: "closeAutocomplete" });

      expect(next.autocomplete).toBeNull();
    });

    it("is a no-op when autocomplete is already null", () => {
      const next = appReducer(initialState, { type: "closeAutocomplete" });

      expect(next.autocomplete).toBeNull();
    });
  });

  describe("moveAutocomplete", () => {
    const openAt = (index: number) => ({
      ...initialState,
      autocomplete: { open: true, index, prefix: "", context: {} },
    });

    it("moves index down by delta -1", () => {
      const next = appReducer(openAt(3), {
        type: "moveAutocomplete",
        delta: -1,
        count: 10,
      });

      expect(next.autocomplete?.index).toBe(2);
    });

    it("moves index up by delta 1", () => {
      const next = appReducer(openAt(3), {
        type: "moveAutocomplete",
        delta: 1,
        count: 10,
      });

      expect(next.autocomplete?.index).toBe(4);
    });

    it("wraps from index 0 with delta -1 to count - 1", () => {
      const next = appReducer(openAt(0), {
        type: "moveAutocomplete",
        delta: -1,
        count: 5,
      });

      expect(next.autocomplete?.index).toBe(4);
    });

    it("wraps from the last index with delta 1 to 0", () => {
      const next = appReducer(openAt(4), {
        type: "moveAutocomplete",
        delta: 1,
        count: 5,
      });

      expect(next.autocomplete?.index).toBe(0);
    });

    it("is a no-op when autocomplete is null", () => {
      const next = appReducer(initialState, {
        type: "moveAutocomplete",
        delta: 1,
        count: 5,
      });

      expect(next.autocomplete).toBeNull();
    });

    it("is a no-op when count is 0 (popup is empty)", () => {
      const next = appReducer(openAt(2), {
        type: "moveAutocomplete",
        delta: 1,
        count: 0,
      });

      expect(next.autocomplete?.index).toBe(2);
    });

    it("moves within a 1-item popup without going out of range", () => {
      const next = appReducer(openAt(0), {
        type: "moveAutocomplete",
        delta: 1,
        count: 1,
      });

      expect(next.autocomplete?.index).toBe(0);
    });
  });

  describe("commitAutocomplete", () => {
    it("closes the autocomplete popup and sets the prompt to replacement", () => {
      const state = {
        ...initialState,
        prompt: rl("SE"),
        autocomplete: { open: true, index: 1, prefix: "SE", context: {} },
      };
      const next = appReducer(state, {
        type: "commitAutocomplete",
        replacement: "SELECT",
      });

      expect(next.autocomplete).toBeNull();
      expect(next.prompt.text).toBe("SELECT");
    });

    it("is a no-op when autocomplete is already null", () => {
      const next = appReducer(initialState, {
        type: "commitAutocomplete",
        replacement: "SELECT",
      });

      expect(next.autocomplete).toBeNull();
    });

    it("preserves the prior prompt when replacement is empty (driver-driven no-op)", () => {
      const state = {
        ...initialState,
        prompt: rl("SEL"),
        autocomplete: { open: true, index: 0, prefix: "SEL", context: {} },
      };
      const next = appReducer(state, {
        type: "commitAutocomplete",
        replacement: "SEL",
      });

      expect(next.autocomplete).toBeNull();
      expect(next.prompt.text).toBe("SEL");
    });
  });

  describe("historyUp", () => {
    it("increments cursor toward older entries", () => {
      const entries: readonly HistoryEntry[] = [
        { sql: "a", outcome: "ok", timestamp: 0 },
        { sql: "b", outcome: "ok", timestamp: 1 },
      ];
      const state = {
        ...initialState,
        history: { entries, cursor: 0 },
      };
      const next = appReducer(state, { type: "historyUp" });

      expect(next.history.cursor).toBe(1);
    });

    it("is a no-op on empty history (cursor stays at 0)", () => {
      const next = appReducer(initialState, { type: "historyUp" });

      expect(next.history.cursor).toBe(0);
    });

    it("clamps at entries.length once the cursor reaches the oldest entry", () => {
      const entries: readonly HistoryEntry[] = [
        { sql: "a", outcome: "ok", timestamp: 0 },
        { sql: "b", outcome: "ok", timestamp: 1 },
      ];
      const state = {
        ...initialState,
        history: { entries, cursor: entries.length },
      };
      const next = appReducer(state, { type: "historyUp" });

      expect(next.history.cursor).toBe(entries.length);
    });

    it("shows the most-recent entry on the first ↑ from cursor 0", () => {
      const entries: readonly HistoryEntry[] = [
        { sql: "a", outcome: "ok", timestamp: 0 },
        { sql: "b", outcome: "ok", timestamp: 1 },
      ];
      const state = {
        ...initialState,
        history: { entries, cursor: 0 },
      };
      const next = appReducer(state, { type: "historyUp" });

      expect(next.history.entries[next.history.cursor - 1]?.sql).toBe("a");
    });
  });

  describe("historyDown", () => {
    it("decrements cursor toward the typed prompt (0)", () => {
      const entries: readonly HistoryEntry[] = [
        { sql: "a", outcome: "ok", timestamp: 0 },
        { sql: "b", outcome: "ok", timestamp: 1 },
      ];
      const state = {
        ...initialState,
        history: { entries, cursor: 2 },
      };
      const next = appReducer(state, { type: "historyDown" });

      expect(next.history.cursor).toBe(1);
    });

    it("clamps cursor at 0 (returns to the typed prompt)", () => {
      const entries: readonly HistoryEntry[] = [
        { sql: "a", outcome: "ok", timestamp: 0 },
      ];
      const state = {
        ...initialState,
        history: { entries, cursor: 1 },
      };
      const next = appReducer(state, { type: "historyDown" });

      expect(next.history.cursor).toBe(0);
    });

    it("is a no-op when the cursor is already at 0", () => {
      const next = appReducer(
        { ...initialState, history: { entries: [], cursor: 0 } },
        { type: "historyDown" },
      );

      expect(next.history.cursor).toBe(0);
    });
  });

  describe("exportTo", () => {
    it("returns state unchanged (driver owns the CSV write)", () => {
      const lastRowsOutcome: QueryOutcome = {
        kind: "rows",
        columns: [{ name: "a", type: null }],
        rows: [[1]],
      };
      const state = {
        ...initialState,
        prompt: rl("SELECT 1"),
        lastRowsOutcome,
      };
      const next = appReducer(state, {
        type: "exportTo",
        path: "/tmp/out.csv",
      });

      expect(next).toBe(state);
    });
  });

  describe("command", () => {
    it("clears the prompt after a dot-command is dispatched", () => {
      const state = { ...initialState, prompt: rl(".tables") };
      const next = appReducer(state, { type: "command", line: ".tables" });

      expect(next.prompt.text).toBe("");
    });
  });

  describe("loadHistory", () => {
    it("replaces history.entries and resets the cursor to 0", () => {
      const entries: readonly HistoryEntry[] = [
        { sql: "a", outcome: "ok", timestamp: 1 },
        { sql: "b", outcome: "ok", timestamp: 2 },
      ];
      const next = appReducer(initialState, {
        type: "loadHistory",
        entries,
      });

      expect(next.history.entries).toEqual(entries);
      expect(next.history.cursor).toBe(0);
    });

    it("overwrites any prior loaded entries", () => {
      const prior: HistoryEntry = {
        sql: "old",
        outcome: "ok",
        timestamp: 0,
      };
      const state = {
        ...initialState,
        history: { entries: [prior], cursor: 1 },
      };
      const next = appReducer(state, {
        type: "loadHistory",
        entries: [],
      });

      expect(next.history.entries).toEqual([]);
      expect(next.history.cursor).toBe(0);
    });
  });

  describe("recordQuery", () => {
    const entry: HistoryEntry = {
      sql: "SELECT 1",
      outcome: "ok",
      timestamp: 1,
    };
    const outcome: QueryOutcome = {
      kind: "rows",
      columns: [],
      rows: [[1]],
    };

    it("appends the entry to history.entries", () => {
      const next = appReducer(initialState, {
        type: "recordQuery",
        entry,
        outcome,
      });

      expect(next.history.entries).toEqual([entry]);
    });

    it("appends sql+outcome to pastQueries", () => {
      const next = appReducer(initialState, {
        type: "recordQuery",
        entry,
        outcome,
      });

      expect(next.pastQueries).toEqual([{ sql: entry.sql, outcome }]);
    });

    it("preserves prior history.entries", () => {
      const prior: HistoryEntry = {
        sql: "SELECT 0",
        outcome: "ok",
        timestamp: 0,
      };
      const state = {
        ...initialState,
        history: { entries: [prior], cursor: 1 },
      };
      const next = appReducer(state, {
        type: "recordQuery",
        entry,
        outcome,
      });

      expect(next.history.entries).toEqual([prior, entry]);
    });
  });

  describe("reverseSearchOpen", () => {
    it("opens reverse-search with an empty query", () => {
      const next = appReducer(initialState, { type: "reverseSearchOpen" });

      expect(next.reverseSearch).toEqual({ query: "" });
    });

    it("replaces a previously open reverse-search", () => {
      const state = {
        ...initialState,
        reverseSearch: { query: "old" },
      };
      const next = appReducer(state, { type: "reverseSearchOpen" });

      expect(next.reverseSearch).toEqual({ query: "" });
    });
  });

  describe("reverseSearchChange", () => {
    it("updates the query string", () => {
      const state = {
        ...initialState,
        reverseSearch: { query: "" },
      };
      const next = appReducer(state, {
        type: "reverseSearchChange",
        query: "sel",
      });

      expect(next.reverseSearch?.query).toBe("sel");
    });

    it("is a no-op when reverse-search is closed", () => {
      const next = appReducer(initialState, {
        type: "reverseSearchChange",
        query: "sel",
      });

      expect(next.reverseSearch).toBeNull();
    });
  });

  describe("reverseSearchCommit", () => {
    it("closes reverse-search", () => {
      const state = {
        ...initialState,
        reverseSearch: { query: "sel" },
      };
      const next = appReducer(state, { type: "reverseSearchCommit" });

      expect(next.reverseSearch).toBeNull();
    });
  });

  describe("reverseSearchCancel", () => {
    it("closes reverse-search without affecting entries or prompt", () => {
      const prior: HistoryEntry = {
        sql: "a",
        outcome: "ok",
        timestamp: 1,
      };
      const state = {
        ...initialState,
        prompt: rl("typed"),
        reverseSearch: { query: "sel" },
        history: { entries: [prior], cursor: 0 },
      };
      const next = appReducer(state, { type: "reverseSearchCancel" });

      expect(next.reverseSearch).toBeNull();
      expect(next.prompt.text).toBe("typed");
      expect(next.history.entries).toEqual([prior]);
    });
  });

  describe("submit + reverse-search interaction", () => {
    it("closes an open reverse-search on submit", () => {
      const state = {
        ...initialState,
        reverseSearch: { query: "sel" },
      };
      const next = appReducer(state, {
        type: "submit",
        outcome: { kind: "rows", columns: [], rows: [[1]] },
      });

      expect(next.reverseSearch).toBeNull();
    });
  });

  describe("setVariable", () => {
    it("appends a new variable as a [name, raw] pair", () => {
      const next = appReducer(initialState, {
        type: "setVariable",
        name: "threshold",
        raw: "100",
      });
      expect(next.variables).toEqual([["threshold", "100"]]);
    });

    it("replaces an existing variable in place", () => {
      const state = {
        ...initialState,
        variables: [
          ["a", "1"],
          ["b", "2"],
        ] as readonly [string, string][],
      };
      const next = appReducer(state, {
        type: "setVariable",
        name: "a",
        raw: "9",
      });
      expect(next.variables).toEqual([
        ["a", "9"],
        ["b", "2"],
      ]);
    });
  });

  describe("unsetVariable", () => {
    it("removes the named variable", () => {
      const state = {
        ...initialState,
        variables: [
          ["a", "1"],
          ["b", "2"],
        ] as readonly [string, string][],
      };
      const next = appReducer(state, { type: "unsetVariable", name: "a" });
      expect(next.variables).toEqual([["b", "2"]]);
    });

    it("is a no-op for a missing variable", () => {
      const state = {
        ...initialState,
        variables: [["a", "1"]] as readonly [string, string][],
      };
      const next = appReducer(state, { type: "unsetVariable", name: "z" });
      expect(next.variables).toEqual([["a", "1"]]);
    });
  });

  describe("loadFavorites", () => {
    it("stores favorites as [name, sql] pairs", () => {
      const next = appReducer(initialState, {
        type: "loadFavorites",
        favorites: [
          ["b", "SELECT 2"],
          ["a", "SELECT 1"],
        ],
      });
      expect(next.favorites).toEqual([
        ["b", "SELECT 2"],
        ["a", "SELECT 1"],
      ]);
    });
  });

  describe("commitFavorite", () => {
    it("appends a new favorite", () => {
      const next = appReducer(initialState, {
        type: "commitFavorite",
        name: "top",
        sql: "SELECT 1",
      });
      expect(next.favorites).toEqual([["top", "SELECT 1"]]);
    });

    it("overwrites an existing favorite in place", () => {
      const state = {
        ...initialState,
        favorites: [
          ["a", "SELECT 1"],
          ["b", "SELECT 2"],
        ] as readonly [string, string][],
      };
      const next = appReducer(state, {
        type: "commitFavorite",
        name: "a",
        sql: "SELECT 9",
      });
      expect(next.favorites).toEqual([
        ["a", "SELECT 9"],
        ["b", "SELECT 2"],
      ]);
    });
  });

  describe("removeFavorite", () => {
    it("removes the named favorite", () => {
      const state = {
        ...initialState,
        favorites: [
          ["a", "SELECT 1"],
          ["b", "SELECT 2"],
        ] as readonly [string, string][],
      };
      const next = appReducer(state, { type: "removeFavorite", name: "a" });
      expect(next.favorites).toEqual([["b", "SELECT 2"]]);
    });
  });

  describe("setTheme", () => {
    it("replaces the active theme", () => {
      const next = appReducer(initialState, {
        type: "setTheme",
        theme: HIGH_CONTRAST_THEME,
      });
      expect(next.theme).toEqual(HIGH_CONTRAST_THEME);
    });
  });

  describe("openCommandPalette", () => {
    it("opens with an empty query and index 0", () => {
      const next = appReducer(initialState, { type: "openCommandPalette" });

      expect(next.commandPalette).toEqual({ query: "", index: 0 });
    });

    it("replaces a previously open palette and resets it", () => {
      const state = {
        ...initialState,
        commandPalette: { query: "old", index: 3 },
      };
      const next = appReducer(state, { type: "openCommandPalette" });

      expect(next.commandPalette).toEqual({ query: "", index: 0 });
    });
  });

  describe("closeCommandPalette", () => {
    it("sets commandPalette to null", () => {
      const state = {
        ...initialState,
        commandPalette: { query: "sav", index: 1 },
      };
      const next = appReducer(state, { type: "closeCommandPalette" });

      expect(next.commandPalette).toBeNull();
    });

    it("is a no-op when already null", () => {
      const next = appReducer(initialState, { type: "closeCommandPalette" });

      expect(next.commandPalette).toBeNull();
    });
  });

  describe("setCommandPaletteQuery", () => {
    it("updates the query and resets index to 0", () => {
      const state = {
        ...initialState,
        commandPalette: { query: "", index: 3 },
      };
      const next = appReducer(state, {
        type: "setCommandPaletteQuery",
        query: "sav",
      });

      expect(next.commandPalette).toEqual({ query: "sav", index: 0 });
    });

    it("is a no-op when the palette is closed", () => {
      const next = appReducer(initialState, {
        type: "setCommandPaletteQuery",
        query: "sav",
      });

      expect(next.commandPalette).toBeNull();
    });
  });

  describe("moveCommandPalette", () => {
    const openAt = (index: number) => ({
      ...initialState,
      commandPalette: { query: "", index },
    });

    it("moves index down by delta -1", () => {
      const next = appReducer(openAt(3), {
        type: "moveCommandPalette",
        delta: -1,
        count: 10,
      });

      expect(next.commandPalette?.index).toBe(2);
    });

    it("moves index up by delta 1", () => {
      const next = appReducer(openAt(3), {
        type: "moveCommandPalette",
        delta: 1,
        count: 10,
      });

      expect(next.commandPalette?.index).toBe(4);
    });

    it("wraps from index 0 with delta -1 to count - 1", () => {
      const next = appReducer(openAt(0), {
        type: "moveCommandPalette",
        delta: -1,
        count: 5,
      });

      expect(next.commandPalette?.index).toBe(4);
    });

    it("wraps from the last index with delta 1 to 0", () => {
      const next = appReducer(openAt(4), {
        type: "moveCommandPalette",
        delta: 1,
        count: 5,
      });

      expect(next.commandPalette?.index).toBe(0);
    });

    it("is a no-op when the palette is closed", () => {
      const next = appReducer(initialState, {
        type: "moveCommandPalette",
        delta: 1,
        count: 5,
      });

      expect(next.commandPalette).toBeNull();
    });

    it("is a no-op when count is 0 (no matches)", () => {
      const next = appReducer(openAt(2), {
        type: "moveCommandPalette",
        delta: 1,
        count: 0,
      });

      expect(next.commandPalette?.index).toBe(2);
    });
  });
});
