import { describe, expect, it } from "vitest";
import { wrapPrompt } from "./wrapPrompt.ts";

describe("wrapPrompt", () => {
  it("wraps text into rows of viewportColumns width", () => {
    const result = wrapPrompt({ text: "SELECT 12345", viewportColumns: 8 });

    expect(result.rows).toEqual(["SELECT 1", "2345"]);
  });

  it("maps a flat cursor position to (row, col) within the wrapped rows", () => {
    const result = wrapPrompt({ text: "SELECT 12345", viewportColumns: 8 });

    expect(result.cursorToPosition(0)).toEqual({ row: 0, col: 0 });
    expect(result.cursorToPosition(3)).toEqual({ row: 0, col: 3 });
    expect(result.cursorToPosition(8)).toEqual({ row: 1, col: 0 });
    expect(result.cursorToPosition(12)).toEqual({ row: 1, col: 4 });
  });

  it("does not wrap when text length matches viewportColumns exactly", () => {
    const result = wrapPrompt({ text: "ABCD", viewportColumns: 4 });

    expect(result.rows).toEqual(["ABCD"]);
    expect(result.cursorToPosition(4)).toEqual({ row: 0, col: 4 });
  });

  it("clamps viewportColumns to a minimum of 1 so the row loop terminates", () => {
    const result = wrapPrompt({ text: "ABC", viewportColumns: 0 });

    expect(result.rows).toEqual(["A", "B", "C"]);
  });

  it("returns a single empty row for an empty text", () => {
    const result = wrapPrompt({ text: "", viewportColumns: 8 });

    expect(result.rows).toEqual([""]);
  });

  it("joining the wrapped rows yields the original text byte-for-byte", () => {
    const cases = [
      { text: "", viewportColumns: 8 },
      { text: "SELECT 1", viewportColumns: 8 },
      { text: "SELECT 12345", viewportColumns: 8 },
      { text: "ABCDEFGHIJ", viewportColumns: 4 },
      { text: "a".repeat(80), viewportColumns: 20 },
      { text: "with spaces and stuff", viewportColumns: 5 },
    ];
    for (const { text, viewportColumns } of cases) {
      const result = wrapPrompt({ text, viewportColumns });
      expect(result.rows.join("")).toBe(text);
    }
  });

  it("wraps by display width, so wide CJK glyphs count as two columns", () => {
    const result = wrapPrompt({ text: "中中中中", viewportColumns: 5 });

    expect(result.rows).toEqual(["中中", "中中"]);
  });

  it("never splits a surrogate pair across two rows", () => {
    const result = wrapPrompt({ text: "ab😀", viewportColumns: 2 });

    expect(result.rows).toEqual(["ab", "😀"]);
  });
});
