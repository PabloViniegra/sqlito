import { describe, expect, it } from "vitest";
import { recallError } from "./recallError.ts";

describe("recallError", () => {
  it("rehydrates the failed SQL into an empty prompt with cursor at the end", () => {
    const result = recallError({
      prompt: { text: "", cursor: 0 },
      failedSql: "SELECT from nonexistent",
      direction: "up",
    });

    expect(result).toEqual({
      text: "SELECT from nonexistent",
      cursor: "SELECT from nonexistent".length,
    });
  });

  it("returns null when there is no recent failure to recall", () => {
    const result = recallError({
      prompt: { text: "", cursor: 0 },
      failedSql: "",
      direction: "up",
    });

    expect(result).toBeNull();
  });

  it("returns null when the user is mid-typing (prompt not empty) — fall back to history recall", () => {
    const result = recallError({
      prompt: { text: "SELECT", cursor: 6 },
      failedSql: "SELECT from nonexistent",
      direction: "up",
    });

    expect(result).toBeNull();
  });

  it("returns null when the cursor is not at the origin (text-empty but cursor>0 is unreachable, but kept defensive)", () => {
    const result = recallError({
      prompt: { text: "", cursor: 1 },
      failedSql: "SELECT from nonexistent",
      direction: "up",
    });
    expect(result).toBeNull();
  });

  it("returns null on DownArrow — recall is up-only", () => {
    const result = recallError({
      prompt: { text: "", cursor: 0 },
      failedSql: "SELECT from nonexistent",
      direction: "down",
    });

    expect(result).toBeNull();
  });
});
