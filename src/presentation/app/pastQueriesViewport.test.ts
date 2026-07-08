import { describe, expect, it } from "vitest";
import type { PastQuery } from "./appReducer.ts";
import { pastQueriesViewport } from "./pastQueriesViewport.ts";

function q(sql: string): PastQuery {
  return { sql, outcome: { kind: "side-effect" } };
}

function queries(...sqls: string[]): PastQuery[] {
  return sqls.map(q);
}

describe("pastQueriesViewport", () => {
  it("returns an empty view when there are no queries", () => {
    const view = pastQueriesViewport([], 5, 0);
    expect(view).toEqual({
      visible: [],
      overflowBelow: 0,
      canScrollUp: false,
      canScrollDown: false,
    });
  });

  it("returns all queries visible when count is below maxVisible (offset 0)", () => {
    const qs = queries("a", "b", "c");
    const view = pastQueriesViewport(qs, 5, 0);
    expect(view.visible).toEqual(qs);
    expect(view.overflowBelow).toBe(0);
    expect(view.canScrollUp).toBe(false);
    expect(view.canScrollDown).toBe(false);
  });

  it("returns exactly maxVisible queries visible at offset 0 with no overflow", () => {
    const qs = queries("a", "b", "c", "d", "e");
    const view = pastQueriesViewport(qs, 5, 0);
    expect(view.visible).toEqual(qs);
    expect(view.overflowBelow).toBe(0);
    expect(view.canScrollUp).toBe(false);
    expect(view.canScrollDown).toBe(false);
  });

  it("shows the last maxVisible when count exceeds it at offset 0 (canScrollUp only)", () => {
    const qs = queries("a", "b", "c", "d", "e", "f");
    const view = pastQueriesViewport(qs, 5, 0);
    expect(view.visible.map((q) => q.sql)).toEqual(["b", "c", "d", "e", "f"]);
    expect(view.overflowBelow).toBe(1);
    expect(view.canScrollUp).toBe(true);
    expect(view.canScrollDown).toBe(false);
  });

  it("shifts the window by offset 1 (6 queries, excludes the newest)", () => {
    const qs = queries("a", "b", "c", "d", "e", "f");
    const view = pastQueriesViewport(qs, 5, 1);
    expect(view.visible.map((q) => q.sql)).toEqual(["a", "b", "c", "d", "e"]);
    expect(view.overflowBelow).toBe(0);
    expect(view.canScrollUp).toBe(false);
    expect(view.canScrollDown).toBe(true);
  });

  it("shifts the window by offset 2 on 8 queries (one older above, can scroll either way)", () => {
    const qs = queries("a", "b", "c", "d", "e", "f", "g", "h");
    const view = pastQueriesViewport(qs, 5, 2);
    expect(view.visible.map((q) => q.sql)).toEqual(["b", "c", "d", "e", "f"]);
    expect(view.overflowBelow).toBe(1);
    expect(view.canScrollUp).toBe(true);
    expect(view.canScrollDown).toBe(true);
  });

  it("clamps offset to the max (8 queries, offset 5 → 3, shows oldest 5)", () => {
    const qs = queries("a", "b", "c", "d", "e", "f", "g", "h");
    const view = pastQueriesViewport(qs, 5, 5);
    expect(view.visible.map((q) => q.sql)).toEqual(["a", "b", "c", "d", "e"]);
    expect(view.overflowBelow).toBe(0);
    expect(view.canScrollUp).toBe(false);
    expect(view.canScrollDown).toBe(true);
  });

  it("clamps an oversized offset down to the max (8 queries, offset 999)", () => {
    const qs = queries("a", "b", "c", "d", "e", "f", "g", "h");
    const view = pastQueriesViewport(qs, 5, 999);
    expect(view.visible.map((q) => q.sql)).toEqual(["a", "b", "c", "d", "e"]);
    expect(view.overflowBelow).toBe(0);
    expect(view.canScrollUp).toBe(false);
    expect(view.canScrollDown).toBe(true);
  });

  it("clamps a negative offset up to 0", () => {
    const qs = queries("a", "b", "c", "d", "e", "f");
    const view = pastQueriesViewport(qs, 5, -3);
    expect(view.visible.map((q) => q.sql)).toEqual(["b", "c", "d", "e", "f"]);
    expect(view.canScrollUp).toBe(true);
    expect(view.canScrollDown).toBe(false);
  });
});
