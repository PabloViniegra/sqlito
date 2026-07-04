import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveXdgHistoryPath } from "./resolveXdgHistoryPath.ts";

describe("resolveXdgHistoryPath", () => {
  it("uses XDG_DATA_HOME when set", () => {
    expect(resolveXdgHistoryPath({ XDG_DATA_HOME: "/custom/data" })).toBe(
      "/custom/data/sqlito/history.jsonl",
    );
  });

  it("falls back to ~/.local/share/sqlito/history.jsonl", () => {
    expect(resolveXdgHistoryPath({ XDG_DATA_HOME: undefined })).toBe(
      join(homedir(), ".local", "share", "sqlito", "history.jsonl"),
    );
  });

  it("falls back when XDG_DATA_HOME is the empty string", () => {
    expect(resolveXdgHistoryPath({ XDG_DATA_HOME: "" })).toBe(
      join(homedir(), ".local", "share", "sqlito", "history.jsonl"),
    );
  });
});
