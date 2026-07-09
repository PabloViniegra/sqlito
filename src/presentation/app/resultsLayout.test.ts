import { describe, expect, it } from "vitest";
import type { PastQuery } from "./appReducer.ts";
import { countWrappedLines, layoutResults } from "./resultsLayout.ts";

const query = (n: number): PastQuery => ({
  sql: `SELECT ${n}`,
  outcome: { kind: "rows", columns: [], rows: [] },
});

const queries = (n: number): PastQuery[] =>
  Array.from({ length: n }, (_, i) => query(i));

describe("layoutResults", () => {
  it("returns an empty layout when nothing is visible", () => {
    const layout = layoutResults([], 0, 20);

    expect(layout.expanded).toBeNull();
    expect(layout.collapsed).toEqual([]);
    expect(layout.hiddenAbove).toBe(0);
    expect(layout.showIndicator).toBe(false);
  });

  it("hides everything when the budget is gone", () => {
    const layout = layoutResults(queries(3), 2, 0);

    expect(layout.expanded).toBeNull();
    expect(layout.hiddenAbove).toBe(5);
    expect(layout.expandedMaxLines).toBe(0);
  });

  it("expands the bottom-most entry and collapses the rest when they fit", () => {
    const visible = queries(5);

    const layout = layoutResults(visible, 2, 20);

    expect(layout.expanded).toBe(visible[4]);
    expect(layout.collapsed).toEqual(visible.slice(0, 4));
    expect(layout.hiddenAbove).toBe(2);
    expect(layout.showIndicator).toBe(true);
    // 20 - 4 collapsed - 1 indicator
    expect(layout.expandedMaxLines).toBe(15);
  });

  it("drops the oldest collapsed entries when the budget is tight", () => {
    const visible = queries(5);

    // 4 collapsed + indicator + 8 minimum expanded = 13 > 10 → drop until it fits
    const layout = layoutResults(visible, 0, 10);

    expect(layout.expanded).toBe(visible[4]);
    expect(layout.collapsed).toEqual(visible.slice(3, 4));
    expect(layout.hiddenAbove).toBe(3);
    expect(layout.showIndicator).toBe(true);
    expect(layout.expandedMaxLines).toBe(8);
  });

  it("turns the indicator on when the first drop happens", () => {
    const visible = queries(2);

    const fits = layoutResults(visible, 0, 9);
    expect(fits.showIndicator).toBe(false);
    expect(fits.collapsed.length).toBe(1);

    const dropped = layoutResults(visible, 0, 8);
    expect(dropped.collapsed.length).toBe(0);
    expect(dropped.hiddenAbove).toBe(1);
    expect(dropped.showIndicator).toBe(true);
  });

  it("gives the expanded card the whole budget when alone", () => {
    const layout = layoutResults(queries(1), 0, 12);

    expect(layout.collapsed).toEqual([]);
    expect(layout.expandedMaxLines).toBe(12);
    expect(layout.showIndicator).toBe(false);
  });

  it("degrades to a single line on a tiny budget without overflowing", () => {
    const layout = layoutResults(queries(3), 0, 1);

    expect(layout.expanded).not.toBeNull();
    expect(layout.collapsed).toEqual([]);
    // indicator suppressed at budget 1 so total stays within budget
    expect(layout.showIndicator).toBe(false);
    expect(layout.expandedMaxLines).toBe(1);
  });
});

describe("countWrappedLines", () => {
  it("counts one line for short text", () => {
    expect(countWrappedLines("hello", 80)).toBe(1);
  });

  it("counts wrapped lines for long text", () => {
    expect(countWrappedLines("x".repeat(85), 80)).toBe(2);
  });

  it("counts newline-separated segments independently", () => {
    expect(countWrappedLines("a\nb\nc", 80)).toBe(3);
  });

  it("counts empty text as one line", () => {
    expect(countWrappedLines("", 80)).toBe(1);
  });
});
