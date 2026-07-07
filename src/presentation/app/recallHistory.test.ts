import { describe, expect, it } from "vitest";
import type { HistoryEntry } from "../../domain/history/HistoryEntry.ts";
import { recallHistory, type HistoryRecallState } from "./recallHistory.ts";

const ENTRIES: readonly HistoryEntry[] = [
  { sql: "SELECT 1", outcome: "ok", timestamp: 0 },
  { sql: "SELECT 2", outcome: "ok", timestamp: 1 },
  { sql: "SELECT 3", outcome: "ok", timestamp: 2 },
];

const TYPED = { text: "SELECT typed", cursor: 4 };

function freshState(
  overrides: Partial<HistoryRecallState> = {},
): HistoryRecallState {
  return {
    historyCursor: 0,
    stashedPrompt: null,
    ...overrides,
  };
}

describe("recallHistory — boundary-aware history navigation", () => {
  describe("UpArrow at the first visual row", () => {
    it("applies entries[0] and stashes the typed prompt on the first hit", () => {
      const result = recallHistory({
        text: TYPED.text,
        cursor: TYPED.cursor,
        viewportColumns: 80,
        entries: ENTRIES,
        ...freshState(),
        direction: "up",
      });

      expect(result).toEqual({
        kind: "apply",
        prompt: { text: "SELECT 1", cursor: 8 },
        nextHistoryCursor: 1,
        nextStashedPrompt: TYPED,
      });
    });

    it("applies entries[1] on the second hit without re-stashing", () => {
      const stash = { text: "earlier", cursor: 2 };
      const result = recallHistory({
        text: "SELECT 1",
        cursor: 8,
        viewportColumns: 80,
        entries: ENTRIES,
        historyCursor: 1,
        stashedPrompt: stash,
        direction: "up",
      });

      expect(result).toEqual({
        kind: "apply",
        prompt: { text: "SELECT 2", cursor: 8 },
        nextHistoryCursor: 2,
        nextStashedPrompt: stash,
      });
    });

    it("is a noop when history is empty", () => {
      const result = recallHistory({
        text: TYPED.text,
        cursor: TYPED.cursor,
        viewportColumns: 80,
        entries: [],
        ...freshState(),
        direction: "up",
      });

      expect(result).toEqual({ kind: "noop" });
    });

    it("is a noop at the oldest entry (historyCursor already at entries.length)", () => {
      const result = recallHistory({
        text: "SELECT 3",
        cursor: 8,
        viewportColumns: 80,
        entries: ENTRIES,
        historyCursor: ENTRIES.length,
        stashedPrompt: TYPED,
        direction: "up",
      });

      expect(result).toEqual({ kind: "noop" });
    });
  });

  describe("UpArrow mid-prompt (not at the first visual row)", () => {
    it("skips — cursor nav (slice-4 MoveUp) handles it, no history side effect", () => {
      const result = recallHistory({
        text: "SELECT * FROM users WHERE id = 1",
        cursor: 26,
        viewportColumns: 10,
        entries: ENTRIES,
        ...freshState(),
        direction: "up",
      });

      expect(result).toEqual({ kind: "skip" });
    });
  });

  describe("DownArrow at the last visual row", () => {
    it("restores the stashed typed prompt byte-for-byte when stepping back from historyCursor=1", () => {
      const stash = { text: "SELECT typed", cursor: 4 };
      const result = recallHistory({
        text: "SELECT 1",
        cursor: 8,
        viewportColumns: 80,
        entries: ENTRIES,
        historyCursor: 1,
        stashedPrompt: stash,
        direction: "down",
      });

      expect(result).toEqual({
        kind: "apply",
        prompt: stash,
        nextHistoryCursor: 0,
        nextStashedPrompt: null,
      });
    });

    it("is a noop when historyCursor is already 0 (showing the typed prompt)", () => {
      const result = recallHistory({
        text: TYPED.text,
        cursor: TYPED.cursor,
        viewportColumns: 80,
        entries: ENTRIES,
        ...freshState(),
        direction: "down",
      });

      expect(result).toEqual({ kind: "noop" });
    });

    it("is a noop when historyCursor=1 but no stash was ever captured", () => {
      const result = recallHistory({
        text: "SELECT 1",
        cursor: 8,
        viewportColumns: 80,
        entries: ENTRIES,
        historyCursor: 1,
        stashedPrompt: null,
        direction: "down",
      });

      expect(result).toEqual({ kind: "noop" });
    });

    it("steps to entries[historyCursor-2] when historyCursor>1, preserving the stash", () => {
      const stash = { text: "typed", cursor: 1 };
      const result = recallHistory({
        text: "SELECT 2",
        cursor: 8,
        viewportColumns: 80,
        entries: ENTRIES,
        historyCursor: 2,
        stashedPrompt: stash,
        direction: "down",
      });

      expect(result).toEqual({
        kind: "apply",
        prompt: { text: "SELECT 1", cursor: 8 },
        nextHistoryCursor: 1,
        nextStashedPrompt: stash,
      });
    });
  });

  describe("DownArrow mid-prompt (not at the last visual row)", () => {
    it("skips — cursor nav handles it", () => {
      const result = recallHistory({
        text: "SELECT * FROM users WHERE id = 1",
        cursor: 4,
        viewportColumns: 10,
        entries: ENTRIES,
        historyCursor: 2,
        stashedPrompt: TYPED,
        direction: "down",
      });

      expect(result).toEqual({ kind: "skip" });
    });
  });

  describe("Single-row prompts (every cursor is at row 0 AND lastRow)", () => {
    it("UpArrow on a single-row prompt with history recalls entries[0]", () => {
      const result = recallHistory({
        text: "typed",
        cursor: 3,
        viewportColumns: 80,
        entries: ENTRIES,
        ...freshState(),
        direction: "up",
      });

      expect(result).toEqual({
        kind: "apply",
        prompt: { text: "SELECT 1", cursor: 8 },
        nextHistoryCursor: 1,
        nextStashedPrompt: { text: "typed", cursor: 3 },
      });
    });

    it("DownArrow on a single-row prompt with historyCursor=0 is a noop", () => {
      const result = recallHistory({
        text: "typed",
        cursor: 3,
        viewportColumns: 80,
        entries: ENTRIES,
        ...freshState(),
        direction: "down",
      });

      expect(result).toEqual({ kind: "noop" });
    });

    it("DownArrow on a single-row prompt with historyCursor=1 restores the stash", () => {
      const stash = { text: "typed", cursor: 3 };
      const result = recallHistory({
        text: "SELECT 1",
        cursor: 8,
        viewportColumns: 80,
        entries: ENTRIES,
        historyCursor: 1,
        stashedPrompt: stash,
        direction: "down",
      });

      expect(result).toEqual({
        kind: "apply",
        prompt: stash,
        nextHistoryCursor: 0,
        nextStashedPrompt: null,
      });
    });
  });
});
