import { describe, expect, it } from "vitest";
import {
  parseDotCommand,
  parseExportCommand,
  parseHelpCommand,
  parseIndexesCommand,
  parseQuitCommand,
  parseSchemaCommand,
  parseSetCommand,
  parseTablesCommand,
  parseUnsetCommand,
  parseVarsCommand,
} from "./parseCommand.ts";

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

describe("parseTablesCommand", () => {
  it("parses '.tables'", () => {
    expect(parseTablesCommand(".tables")).toEqual({ ok: true });
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseTablesCommand("  .tables  ")).toEqual({ ok: true });
  });

  it("rejects extra arguments", () => {
    const r = parseTablesCommand(".tables users");
    expect(r).toEqual({ ok: false, error: "tables: too many arguments" });
  });

  it("rejects a non-tables command", () => {
    const r = parseTablesCommand(".schema");
    expect(r).toEqual({ ok: false, error: "unknown command: .schema" });
  });
});

describe("parseSchemaCommand", () => {
  it("parses '.schema' with no table", () => {
    expect(parseSchemaCommand(".schema")).toEqual({ ok: true });
  });

  it("parses '.schema users'", () => {
    expect(parseSchemaCommand(".schema users")).toEqual({
      ok: true,
      table: "users",
    });
  });

  it("tolerates multiple spaces before the table", () => {
    expect(parseSchemaCommand(".schema   users")).toEqual({
      ok: true,
      table: "users",
    });
  });

  it("rejects more than one argument", () => {
    const r = parseSchemaCommand(".schema a b");
    expect(r).toEqual({ ok: false, error: "schema: too many arguments" });
  });

  it("rejects a non-schema command", () => {
    const r = parseSchemaCommand(".tables");
    expect(r).toEqual({ ok: false, error: "unknown command: .tables" });
  });
});

describe("parseIndexesCommand", () => {
  it("parses '.indexes'", () => {
    expect(parseIndexesCommand(".indexes")).toEqual({ ok: true });
  });

  it("rejects extra arguments", () => {
    const r = parseIndexesCommand(".indexes t");
    expect(r).toEqual({ ok: false, error: "indexes: too many arguments" });
  });

  it("rejects a non-indexes command", () => {
    expect(parseIndexesCommand(".help")).toEqual({
      ok: false,
      error: "unknown command: .help",
    });
  });
});

describe("parseHelpCommand", () => {
  it("parses '.help'", () => {
    expect(parseHelpCommand(".help")).toEqual({ ok: true });
  });

  it("rejects extra arguments", () => {
    expect(parseHelpCommand(".help me")).toEqual({
      ok: false,
      error: "help: too many arguments",
    });
  });
});

describe("parseQuitCommand", () => {
  it("parses '.quit'", () => {
    expect(parseQuitCommand(".quit")).toEqual({ ok: true });
  });

  it("parses '.exit' as an alias", () => {
    expect(parseQuitCommand(".exit")).toEqual({ ok: true });
  });

  it("rejects extra arguments", () => {
    expect(parseQuitCommand(".quit now")).toEqual({
      ok: false,
      error: "quit: too many arguments",
    });
  });

  it("rejects a non-quit command", () => {
    expect(parseQuitCommand(".tables")).toEqual({
      ok: false,
      error: "unknown command: .tables",
    });
  });
});

describe("parseDotCommand (dispatcher)", () => {
  it("routes '.export /tmp/x.csv' to an export command", () => {
    expect(parseDotCommand(".export /tmp/x.csv")).toEqual({
      ok: true,
      command: { kind: "export", path: "/tmp/x.csv" },
    });
  });

  it("propagates export parse errors", () => {
    expect(parseDotCommand(".export")).toEqual({
      ok: false,
      error: "export: missing path",
    });
  });

  it("routes '.tables'", () => {
    expect(parseDotCommand(".tables")).toEqual({
      ok: true,
      command: { kind: "tables" },
    });
  });

  it("routes '.schema users'", () => {
    expect(parseDotCommand(".schema users")).toEqual({
      ok: true,
      command: { kind: "schema", table: "users" },
    });
  });

  it("routes '.schema' with no table", () => {
    expect(parseDotCommand(".schema")).toEqual({
      ok: true,
      command: { kind: "schema" },
    });
  });

  it("routes '.indexes'", () => {
    expect(parseDotCommand(".indexes")).toEqual({
      ok: true,
      command: { kind: "indexes" },
    });
  });

  it("routes '.help'", () => {
    expect(parseDotCommand(".help")).toEqual({
      ok: true,
      command: { kind: "help" },
    });
  });

  it("routes '.quit' and '.exit' to quit", () => {
    expect(parseDotCommand(".quit")).toEqual({
      ok: true,
      command: { kind: "quit" },
    });
    expect(parseDotCommand(".exit")).toEqual({
      ok: true,
      command: { kind: "quit" },
    });
  });

  it("errors on an unknown dot-command", () => {
    expect(parseDotCommand(".nope")).toEqual({
      ok: false,
      error: "unknown command: .nope",
    });
  });

  it("errors on non-dot input", () => {
    expect(parseDotCommand("SELECT 1")).toEqual({
      ok: false,
      error: "unknown command: SELECT 1",
    });
  });
});

describe("parseSetCommand", () => {
  it("parses '.set threshold 100'", () => {
    expect(parseSetCommand(".set threshold 100")).toEqual({
      ok: true,
      name: "threshold",
      raw: "100",
    });
  });

  it("keeps a multi-word value", () => {
    expect(parseSetCommand(".set greeting hello world")).toEqual({
      ok: true,
      name: "greeting",
      raw: "hello world",
    });
  });

  it("errors on a missing name", () => {
    expect(parseSetCommand(".set")).toEqual({
      ok: false,
      error: "set: missing name",
    });
  });

  it("errors on a missing value", () => {
    expect(parseSetCommand(".set threshold")).toEqual({
      ok: false,
      error: "set: missing value",
    });
  });

  it("rejects a non-set command", () => {
    expect(parseSetCommand(".vars")).toEqual({
      ok: false,
      error: "unknown command: .vars",
    });
  });
});

describe("parseUnsetCommand", () => {
  it("parses '.unset threshold'", () => {
    expect(parseUnsetCommand(".unset threshold")).toEqual({
      ok: true,
      name: "threshold",
    });
  });

  it("errors on a missing name", () => {
    expect(parseUnsetCommand(".unset")).toEqual({
      ok: false,
      error: "unset: missing name",
    });
  });

  it("errors on too many arguments", () => {
    expect(parseUnsetCommand(".unset a b")).toEqual({
      ok: false,
      error: "unset: too many arguments",
    });
  });
});

describe("parseVarsCommand", () => {
  it("parses '.vars'", () => {
    expect(parseVarsCommand(".vars")).toEqual({ ok: true });
  });

  it("errors on extra arguments", () => {
    expect(parseVarsCommand(".vars x")).toEqual({
      ok: false,
      error: "vars: too many arguments",
    });
  });
});

describe("parseDotCommand (variables)", () => {
  it("routes '.set threshold 100'", () => {
    expect(parseDotCommand(".set threshold 100")).toEqual({
      ok: true,
      command: { kind: "set", name: "threshold", raw: "100" },
    });
  });

  it("routes '.unset threshold'", () => {
    expect(parseDotCommand(".unset threshold")).toEqual({
      ok: true,
      command: { kind: "unset", name: "threshold" },
    });
  });

  it("routes '.vars'", () => {
    expect(parseDotCommand(".vars")).toEqual({
      ok: true,
      command: { kind: "vars" },
    });
  });
});
