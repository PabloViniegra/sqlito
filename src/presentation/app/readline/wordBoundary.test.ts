import { describe, expect, it } from "vitest";
import { findWordLeft, findWordRight } from "./wordBoundary.ts";

describe("findWordLeft", () => {
  it("skips back to the start of the word under the cursor", () => {
    expect(findWordLeft("SELECT * FROM users", 18)).toBe(14);
  });

  it("is a no-op at the start of text", () => {
    expect(findWordLeft("SELECT * FROM users", 0)).toBe(0);
  });

  it("is a no-op on empty text", () => {
    expect(findWordLeft("", 0)).toBe(0);
  });

  it("skips separators before landing on the previous word start", () => {
    expect(findWordLeft("SELECT * FROM users", 13)).toBe(9);
  });

  it("lands on the previous word when the cursor sits in whitespace", () => {
    expect(findWordLeft("SELECT * FROM users", 6)).toBe(0);
  });

  it("treats the cursor at the start of a word as 'inside' that word", () => {
    expect(findWordLeft("SELECT * FROM users", 7)).toBe(0);
  });
});

describe("findWordRight", () => {
  it("skips forward to the end of the word under the cursor", () => {
    expect(findWordRight("SELECT * FROM users", 14)).toBe(19);
  });

  it("is a no-op at the end of text", () => {
    expect(findWordRight("SELECT * FROM users", 19)).toBe(19);
  });

  it("is a no-op on empty text", () => {
    expect(findWordRight("", 0)).toBe(0);
  });

  it("skips separators and lands on the end of the next word", () => {
    expect(findWordRight("SELECT * FROM users", 6)).toBe(13);
  });

  it("treats the cursor at the end of a word as 'inside' that word", () => {
    expect(findWordRight("SELECT * FROM users", 13)).toBe(19);
  });
});

describe("word boundary edge cases", () => {
  it("treats all-whitespace text as one big separator", () => {
    expect(findWordLeft("   ", 3)).toBe(0);
    expect(findWordRight("   ", 0)).toBe(3);
  });

  it("treats all-punctuation text as one big separator", () => {
    expect(findWordLeft("()()", 4)).toBe(0);
    expect(findWordRight("()()", 0)).toBe(4);
  });

  it("treats identifiers with underscores as one word", () => {
    expect(findWordLeft("user_id_42", 9)).toBe(0);
    expect(findWordRight("user_id_42", 0)).toBe(10);
  });

  it("handles digit-only words", () => {
    expect(findWordLeft("abc 123 def", 7)).toBe(4);
    expect(findWordRight("abc 123 def", 4)).toBe(7);
  });

  it("does not treat unicode letters as word chars", () => {
    expect(findWordLeft("café", 4)).toBe(0);
    expect(findWordRight("café", 0)).toBe(3);
  });

  it("clamps when the cursor is past the end of text", () => {
    expect(findWordLeft("abc", 99)).toBe(0);
    expect(findWordRight("abc", 99)).toBe(3);
  });

  it("clamps a negative cursor to 0 and proceeds", () => {
    expect(findWordLeft("abc", -5)).toBe(0);
    expect(findWordRight("abc", -5)).toBe(3);
  });

  it("treats a single-quoted region as one word when entering from outside", () => {
    expect(findWordLeft("SELECT 'foo bar' FROM t", 16)).toBe(7);
    expect(findWordRight("SELECT 'foo bar' FROM t", 6)).toBe(16);
  });

  it("treats a double-quoted region as one word when entering from outside", () => {
    expect(findWordLeft(`SELECT "foo bar" FROM t`, 16)).toBe(7);
    expect(findWordRight(`SELECT "foo bar" FROM t`, 6)).toBe(16);
  });

  it("does not merge quoted regions with adjacent non-quoted words", () => {
    expect(findWordRight("SELECT 'foo bar' FROM t", 0)).toBe(6);
    expect(findWordLeft("SELECT 'foo bar' FROM t", 21)).toBe(17);
  });

  it("handles a run of SQL keywords", () => {
    expect(findWordLeft("SELECT WHERE ORDER", 16)).toBe(13);
    expect(findWordRight("SELECT WHERE ORDER", 0)).toBe(6);
  });
});
