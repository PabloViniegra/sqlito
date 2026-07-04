import stringWidth from "string-width";
import { describe, expect, it } from "vitest";
import { formatCell, truncateCell } from "./formatCell.ts";

describe("formatCell", () => {
  it('renders null as the literal "NULL"', () => {
    expect(formatCell(null)).toBe("NULL");
  });

  it('renders undefined as the literal "NULL"', () => {
    expect(formatCell(undefined)).toBe("NULL");
  });

  it("renders bigint as its numeric string", () => {
    expect(formatCell(42n)).toBe("42");
    expect(formatCell(BigInt("9007199254740993"))).toBe("9007199254740993");
  });

  it("renders finite numbers as their string form", () => {
    expect(formatCell(0)).toBe("0");
    expect(formatCell(-3.14)).toBe("-3.14");
  });

  it('renders booleans as "true" / "false"', () => {
    expect(formatCell(true)).toBe("true");
    expect(formatCell(false)).toBe("false");
  });

  it("returns plain strings unchanged", () => {
    expect(formatCell("Ada")).toBe("Ada");
    expect(formatCell("")).toBe("");
  });

  it("measures ANSI-styled strings by visible width", () => {
    const styled = "\u001b[31mhello\u001b[39m";
    expect(formatCell(styled)).toBe(styled);
    expect(stringWidth(formatCell(styled))).toBe(5);
  });

  it("falls back to JSON.stringify for nested objects", () => {
    expect(formatCell({ a: 1 })).toBe('{"a":1}');
    expect(formatCell([1, 2])).toBe("[1,2]");
  });

  it('renders Buffer values as "<binary>"', () => {
    expect(formatCell(Buffer.from("hi"))).toBe("<binary>");
  });
});

describe("truncateCell", () => {
  it("returns short strings unchanged", () => {
    expect(truncateCell("hello", 10)).toBe("hello");
  });

  it("returns the original when width equals the visible width", () => {
    expect(truncateCell("hello", 5)).toBe("hello");
  });

  it("truncates over-width strings with an ellipsis", () => {
    const result = truncateCell("hello world", 6);
    expect(result.endsWith("…")).toBe(true);
    expect(stringWidth(result)).toBeLessThanOrEqual(6);
  });

  it("preserves visible width when ANSI styles wrap the text", () => {
    const styled = "\u001b[31mfoo bar baz qux\u001b[39m";
    const result = truncateCell(styled, 6);
    expect(stringWidth(result)).toBeLessThanOrEqual(6);
    expect(result.includes("…")).toBe(true);
  });

  it("returns an empty string when maxWidth is zero or negative", () => {
    expect(truncateCell("anything", 0)).toBe("");
    expect(truncateCell("anything", -1)).toBe("");
  });
});
