import stringWidth from "string-width";
import { describe, expect, it } from "vitest";
import type { Column } from "../../domain/sql/Column.ts";
import { formatBorderedTable } from "./formatBorderedTable.ts";
import { MIN_COL_WIDTH } from "./measureColumn.ts";

const makeColumns = (n: number): Column[] =>
  Array.from({ length: n }, (_, i) => ({ name: `column_${i}`, type: null }));

const makeRow = (n: number): unknown[] =>
  Array.from({ length: n }, (_, i) => `value number ${i} with some width`);

describe("formatBorderedTable", () => {
  it("returns no lines for zero columns", () => {
    expect(formatBorderedTable([], [], 80)).toEqual({
      lines: [],
      hiddenColumns: 0,
    });
  });

  it("renders a small table exactly as wide as its content", () => {
    const { lines, hiddenColumns } = formatBorderedTable(
      [
        { name: "id", type: null },
        { name: "name", type: null },
      ],
      [[1, "Ada"]],
      80,
    );

    expect(hiddenColumns).toBe(0);
    expect(lines).toEqual([
      "+----+------+",
      "| id | name |",
      "+----+------+",
      "| 1  | Ada  |",
      "+----+------+",
    ]);
  });

  it.each([40, 80])(
    "never emits a line wider than the terminal (%d cols wide, 20 columns)",
    (terminalWidth) => {
      const { lines } = formatBorderedTable(
        makeColumns(20),
        [makeRow(20), makeRow(20)],
        terminalWidth,
      );

      for (const line of lines) {
        expect(stringWidth(line)).toBeLessThanOrEqual(terminalWidth);
      }
    },
  );

  it("drops columns that cannot fit instead of squeezing them to zero", () => {
    const terminalWidth = 40;
    const { lines, hiddenColumns } = formatBorderedTable(
      makeColumns(12),
      [makeRow(12)],
      terminalWidth,
    );

    // at width 40 only floor(39/7)=5 columns fit at MIN_COL_WIDTH
    expect(hiddenColumns).toBe(7);
    // every rendered column keeps at least MIN_COL_WIDTH: no empty "||" cells
    for (const line of lines) {
      expect(line).not.toContain("||");
      expect(line).not.toContain("|  |");
    }
    const dashRuns = lines[0]!.split("+").filter((s) => s.length > 0);
    expect(dashRuns.length).toBe(5);
    for (const run of dashRuns) {
      expect(run.length).toBeGreaterThanOrEqual(MIN_COL_WIDTH + 2);
    }
  });

  it("truncates over-wide headers instead of overflowing the line", () => {
    const terminalWidth = 24;
    const { lines } = formatBorderedTable(
      [
        { name: "a_very_long_header_name", type: null },
        { name: "another_long_header", type: null },
      ],
      [["x", "y"]],
      terminalWidth,
    );

    for (const line of lines) {
      expect(stringWidth(line)).toBeLessThanOrEqual(terminalWidth);
    }
    expect(lines[1]).toContain("…");
  });

  it("truncates over-wide values with an ellipsis", () => {
    const { lines } = formatBorderedTable(
      [
        { name: "id", type: null },
        { name: "text", type: null },
      ],
      [[1, "x".repeat(200)]],
      40,
    );

    for (const line of lines) {
      expect(stringWidth(line)).toBeLessThanOrEqual(40);
    }
    expect(lines[3]).toContain("…");
  });
});
