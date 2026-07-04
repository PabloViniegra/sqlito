import { describe, expect, it } from "vitest";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";
import type { HistoryEntry } from "./appReducer.ts";
import { appReducer, initialState } from "./appReducer.ts";

describe("appReducer", () => {
  describe("setPrompt", () => {
    it("updates state.prompt to the new value", () => {
      const next = appReducer(initialState, {
        type: "setPrompt",
        value: "SELECT 1",
      });

      expect(next.prompt).toBe("SELECT 1");
    });
  });

  describe("backspace", () => {
    it("removes the last character from prompt", () => {
      const state = { ...initialState, prompt: "SELECT" };
      const next = appReducer(state, { type: "backspace" });

      expect(next.prompt).toBe("SELEC");
    });

    it("leaves an empty prompt empty", () => {
      const next = appReducer(initialState, { type: "backspace" });

      expect(next.prompt).toBe("");
    });
  });

  describe("clearPrompt", () => {
    it("empties the prompt", () => {
      const state = { ...initialState, prompt: "SELECT 1" };
      const next = appReducer(state, { type: "clearPrompt" });

      expect(next.prompt).toBe("");
    });
  });

  describe("submit", () => {
    const rowsOutcome: QueryOutcome = {
      kind: "rows",
      columns: [{ name: "a", type: null }],
      rows: [[1]],
    };

    it("clears the prompt", () => {
      const state = { ...initialState, prompt: "SELECT 1" };
      const next = appReducer(state, {
        type: "submit",
        outcome: rowsOutcome,
      });

      expect(next.prompt).toBe("");
    });

    it("is a no-op for prompt when prompt is empty (prompt stays empty)", () => {
      const next = appReducer(initialState, {
        type: "submit",
        outcome: rowsOutcome,
      });

      expect(next.prompt).toBe("");
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
        prompt: "SELECT 1",
        statusMessage: { text: "msg", kind: "info" as const },
      };
      const next = appReducer(state, { type: "exit" });

      expect(next).toBe(state);
    });
  });

  describe("openAutocomplete", () => {
    it("opens autocomplete with index 0 and empty prefix/context", () => {
      const next = appReducer(initialState, { type: "openAutocomplete" });

      expect(next.autocomplete).toEqual({
        open: true,
        index: 0,
        prefix: "",
        context: {},
      });
    });

    it("replaces a previously open autocomplete", () => {
      const state = {
        ...initialState,
        autocomplete: {
          open: true,
          index: 3,
          prefix: "old",
          context: { precedingToken: "x" },
        },
      };
      const next = appReducer(state, { type: "openAutocomplete" });

      expect(next.autocomplete).toEqual({
        open: true,
        index: 0,
        prefix: "",
        context: {},
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
      });

      expect(next.autocomplete?.index).toBe(2);
    });

    it("moves index up by delta 1", () => {
      const next = appReducer(openAt(3), {
        type: "moveAutocomplete",
        delta: 1,
      });

      expect(next.autocomplete?.index).toBe(4);
    });

    it("clamps at 0 when moving up from index 0", () => {
      const next = appReducer(openAt(0), {
        type: "moveAutocomplete",
        delta: -1,
      });

      expect(next.autocomplete?.index).toBe(0);
    });

    it("is a no-op when autocomplete is null", () => {
      const next = appReducer(initialState, {
        type: "moveAutocomplete",
        delta: 1,
      });

      expect(next.autocomplete).toBeNull();
    });
  });

  describe("commitAutocomplete", () => {
    it("closes the autocomplete popup", () => {
      const state = {
        ...initialState,
        autocomplete: { open: true, index: 1, prefix: "sel", context: {} },
      };
      const next = appReducer(state, { type: "commitAutocomplete" });

      expect(next.autocomplete).toBeNull();
    });

    it("is a no-op when autocomplete is already null", () => {
      const next = appReducer(initialState, { type: "commitAutocomplete" });

      expect(next.autocomplete).toBeNull();
    });
  });

  describe("historyUp", () => {
    it("decrements cursor by 1", () => {
      const entries: readonly HistoryEntry[] = [
        { sql: "a", outcome: "ok", timestamp: 0 },
      ];
      const state = {
        ...initialState,
        history: { entries, cursor: 1 },
      };
      const next = appReducer(state, { type: "historyUp" });

      expect(next.history.cursor).toBe(0);
    });

    it("clamps cursor at 0", () => {
      const entries: readonly HistoryEntry[] = [
        { sql: "a", outcome: "ok", timestamp: 0 },
      ];
      const state = {
        ...initialState,
        history: { entries, cursor: 0 },
      };
      const next = appReducer(state, { type: "historyUp" });

      expect(next.history.cursor).toBe(0);
    });
  });

  describe("historyDown", () => {
    it("increments cursor by 1", () => {
      const entries: readonly HistoryEntry[] = [
        { sql: "a", outcome: "ok", timestamp: 0 },
        { sql: "b", outcome: "ok", timestamp: 1 },
      ];
      const state = {
        ...initialState,
        history: { entries, cursor: 0 },
      };
      const next = appReducer(state, { type: "historyDown" });

      expect(next.history.cursor).toBe(1);
    });

    it("clamps cursor at entries.length", () => {
      const entries: readonly HistoryEntry[] = [
        { sql: "a", outcome: "ok", timestamp: 0 },
      ];
      const state = {
        ...initialState,
        history: { entries, cursor: 1 },
      };
      const next = appReducer(state, { type: "historyDown" });

      expect(next.history.cursor).toBe(1);
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
        prompt: "SELECT 1",
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
    it("returns state unchanged (driver owns dot-command dispatch)", () => {
      const state = { ...initialState, prompt: "SELECT 1" };
      const next = appReducer(state, { type: "command", line: ".tables" });

      expect(next).toBe(state);
    });
  });
});
