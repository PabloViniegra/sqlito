import { describe, expect, it } from "vitest";
import { parseExportCommand } from "./parseCommand.ts";

describe("parseExportCommand", () => {
  it("parses '.export /tmp/users.csv'", () => {
    expect(parseExportCommand(".export /tmp/users.csv")).toEqual({
      ok: true,
      path: "/tmp/users.csv",
    });
  });

  it("parses '.export ./relative.csv' (relative path)", () => {
    expect(parseExportCommand(".export ./relative.csv")).toEqual({
      ok: true,
      path: "./relative.csv",
    });
  });

  it("tolerates leading whitespace before the dot", () => {
    expect(parseExportCommand("   .export /tmp/x.csv")).toEqual({
      ok: true,
      path: "/tmp/x.csv",
    });
  });

  it("tolerates multiple spaces between command and path", () => {
    expect(parseExportCommand(".export   /tmp/x.csv")).toEqual({
      ok: true,
      path: "/tmp/x.csv",
    });
  });

  it("tolerates tab between command and path", () => {
    expect(parseExportCommand(".export\t/tmp/x.csv")).toEqual({
      ok: true,
      path: "/tmp/x.csv",
    });
  });

  it("returns path error for an empty path", () => {
    const result = parseExportCommand(".export");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error");
    expect(result.error).toBe("export: missing path");
  });

  it("returns path error when only whitespace follows the command", () => {
    const result = parseExportCommand(".export   ");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error");
    expect(result.error).toBe("export: missing path");
  });

  it("returns unknown-command error for a non-export dot-command", () => {
    const result = parseExportCommand(".tables");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error");
    expect(result.error).toBe("unknown command: .tables");
  });

  it("returns unknown-command error for plain SQL input", () => {
    const result = parseExportCommand("SELECT 1");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error");
    expect(result.error).toBe("unknown command: SELECT 1");
  });

  it("returns unknown-command error for an empty string", () => {
    const result = parseExportCommand("");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error");
    expect(result.error).toBe("unknown command: ");
  });

  it("treats the first token case-sensitively (no EXPORT in caps)", () => {
    const result = parseExportCommand(".EXPORT /tmp/x.csv");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error");
    expect(result.error).toBe("unknown command: .EXPORT /tmp/x.csv");
  });

  it("ignores tokens after the path (path is the second token only)", () => {
    const result = parseExportCommand(".export /tmp/x.csv extra");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error");
    expect(result.error).toBe("export: too many arguments");
  });
});
