import stringWidth from "string-width";
import { describe, expect, it } from "vitest";
import { computeColumnWidths, MIN_COL_WIDTH } from "./measureColumn.ts";

describe("computeColumnWidths", () => {
  it("returns an empty array when there are no columns", () => {
    expect(computeColumnWidths([], [], 80)).toEqual([]);
  });

  it("aligns a 1x1 row to its header", () => {
    const widths = computeColumnWidths(
      [{ name: "only", type: null }],
      [["Ada"]],
      80,
    );
    expect(widths).toEqual([4]);

    const headerWidth = stringWidth("only");
    const valueWidth = stringWidth("Ada");
    expect(widths[0]).toBe(Math.max(headerWidth, valueWidth));
  });

  it("uses the wider of header and value widths", () => {
    const widths = computeColumnWidths(
      [
        { name: "id", type: null },
        { name: "name", type: null },
      ],
      [
        [1, "Ada Lovelace"],
        [2, "Lin"],
      ],
      80,
    );
    expect(widths[0]).toBe(2);
    expect(widths[1]).toBe(stringWidth("Ada Lovelace"));
  });

  it("caps total content width at the budget", () => {
    const columns = [
      { name: "id", type: null },
      { name: "description", type: null },
      { name: "owner", type: null },
    ];
    const rows = [
      [
        1,
        "a very long description that should be truncated",
        "a very long owner name that should also be truncated",
      ],
    ];
    const contentBudget = 30;

    const widths = computeColumnWidths(columns, rows, contentBudget);

    const totalWidth = widths.reduce((a, b) => a + b, 0);
    expect(totalWidth).toBeLessThanOrEqual(contentBudget);
    expect(widths.every((w) => w >= 1)).toBe(true);
  });

  it("never squeezes a column below MIN_COL_WIDTH when the budget allows it", () => {
    const columns = Array.from({ length: 5 }, (_, i) => ({
      name: `col_${i}`,
      type: null,
    }));
    const rows = [columns.map(() => "a value that is fairly wide indeed")];

    const widths = computeColumnWidths(columns, rows, 40);

    expect(widths.every((w) => w >= MIN_COL_WIDTH)).toBe(true);
    expect(widths.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(40);
  });

  it("returns exact desired widths when they fit in the terminal", () => {
    const columns = [
      { name: "id", type: null },
      { name: "name", type: null },
    ];
    const rows = [
      [1, "Ada"],
      [2, "Lin"],
    ];
    const widths = computeColumnWidths(columns, rows, 80);
    expect(widths).toEqual([2, 4]);
  });

  it("handles a single column without any gap", () => {
    const widths = computeColumnWidths(
      [{ name: "id", type: null }],
      [[1], [2]],
      10,
    );
    expect(widths.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(10);
    expect(widths[0]).toBe(2);
  });
});
