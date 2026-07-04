import { describe, expect, it } from "vitest";
import { formatRows } from "./formatRows.ts";

describe("formatRows", () => {
  it("renders header, separator, and left-aligned rows", () => {
    const lines = formatRows(
      [
        { name: "id", type: null },
        { name: "name", type: null },
      ],
      [
        [1, "Ada"],
        [2, "Lin"],
      ],
    );

    expect(lines).toEqual(["id  name", "--  ----", "1   Ada ", "2   Lin "]);
  });

  it("returns just a header when rows are empty", () => {
    const lines = formatRows([{ name: "x", type: null }], []);

    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("x");
    expect(lines[1]).toBe("-");
  });

  it("handles a single column", () => {
    const lines = formatRows([{ name: "only", type: null }], [["a"], ["bb"]]);

    expect(lines).toEqual(["only", "----", "a   ", "bb  "]);
  });

  it('renders null cells as "NULL" instead of empty strings', () => {
    const lines = formatRows(
      [
        { name: "id", type: null },
        { name: "name", type: null },
      ],
      [
        [1, null],
        [2, undefined],
      ],
      80,
    );

    expect(lines[0]).toBe("id  name");
    expect(lines[2]).toBe("1   NULL");
    expect(lines[3]).toBe("2   NULL");
  });

  it("renders bigint cells as their numeric string", () => {
    const lines = formatRows(
      [{ name: "rowid", type: null }],
      [[42n], [9007199254740993n]],
      80,
    );

    expect(lines[2]).toBe("42              ");
    expect(lines[3]).toBe("9007199254740993");
  });

  it("truncates over-wide cells with an ellipsis at narrow terminal widths", () => {
    const lines = formatRows(
      [
        { name: "id", type: null },
        { name: "description", type: null },
      ],
      [[1, "this is a very long description that should truncate"]],
      20,
    );

    const body = lines[2]!;
    expect(body.length).toBeLessThanOrEqual(20);
    expect(body).toContain("…");
  });

  it("1x1 row still aligns with the header", () => {
    const lines = formatRows([{ name: "only", type: null }], [["Ada"]], 80);

    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("only");
    expect(lines[2]).toBe("Ada ");
  });
});
