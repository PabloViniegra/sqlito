import { afterEach, describe, expect, it } from "vitest";
import { BetterSqliteDatabase } from "../../infrastructure/sqlite/BetterSqliteDatabase.ts";
import { ExecuteQuery } from "./ExecuteQuery.ts";

describe("ExecuteQuery", () => {
  let db: BetterSqliteDatabase;
  let useCase: ExecuteQuery;

  afterEach(() => db?.close());

  const setup = (): ExecuteQuery => {
    db = new BetterSqliteDatabase(":memory:");
    useCase = new ExecuteQuery(db);
    return useCase;
  };

  it("executes SELECT and returns rows", () => {
    const exec = setup();

    const outcome = exec.execute("SELECT 1 AS a");

    expect(outcome.kind).toBe("rows");
    if (outcome.kind !== "rows") throw new Error("expected rows");
    expect(outcome.columns).toEqual([{ name: "a", type: null }]);
    expect(outcome.rows).toEqual([[1]]);
  });

  it("executes SELECT with multiple rows and preserves cell values", () => {
    const exec = setup();
    db.prepare("CREATE TABLE t (id INTEGER, name TEXT)").run();
    db.prepare("INSERT INTO t VALUES (1, 'Ada'), (2, 'Lin')").run();

    const outcome = exec.execute("SELECT id, name FROM t ORDER BY id");

    expect(outcome.kind).toBe("rows");
    if (outcome.kind !== "rows") throw new Error("expected rows");
    expect(outcome.columns.map((c) => c.name)).toEqual(["id", "name"]);
    expect(outcome.rows).toEqual([
      [1, "Ada"],
      [2, "Lin"],
    ]);
  });

  it("returns empty rows when SELECT matches nothing", () => {
    const exec = setup();

    const outcome = exec.execute("SELECT 1 WHERE 0");

    expect(outcome.kind).toBe("rows");
    if (outcome.kind !== "rows") throw new Error("expected rows");
    expect(outcome.rows).toEqual([]);
  });

  it("returns error outcome for invalid SQL", () => {
    const exec = setup();

    const outcome = exec.execute("SELECT FROM");

    expect(outcome.kind).toBe("error");
  });

  it("executes INSERT and returns affected outcome", () => {
    const exec = setup();
    db.prepare("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)").run();

    const outcome = exec.execute("INSERT INTO t (name) VALUES ('Ada')");

    expect(outcome.kind).toBe("affected");
    if (outcome.kind !== "affected") throw new Error("expected affected");
    expect(outcome.changes).toBe(1);
    expect(Number(outcome.lastInsertRowid)).toBeGreaterThan(0);
  });

  it("executes CREATE TABLE (DDL) and returns affected outcome", () => {
    const exec = setup();

    const outcome = exec.execute("CREATE TABLE t (id INTEGER)");

    expect(outcome.kind).toBe("affected");
    if (outcome.kind !== "affected") throw new Error("expected affected");
    expect(outcome.changes).toBe(0);
    expect(Number(outcome.lastInsertRowid)).toBe(0);
  });

  it("executes UPDATE and returns affected outcome with change count", () => {
    const exec = setup();
    db.prepare("CREATE TABLE t (id INTEGER, name TEXT)").run();
    db.prepare("INSERT INTO t VALUES (1, 'a'), (2, 'b')").run();

    const outcome = exec.execute("UPDATE t SET name = 'x' WHERE id = 1");

    expect(outcome.kind).toBe("affected");
    if (outcome.kind !== "affected") throw new Error("expected affected");
    expect(outcome.changes).toBe(1);
  });

  it("returns error outcome for syntax error", () => {
    const exec = setup();

    const outcome = exec.execute("SELECT syntax_error");

    expect(outcome.kind).toBe("error");
    if (outcome.kind !== "error") throw new Error("expected error");
    expect(outcome.message.length).toBeGreaterThan(0);
  });

  it("captures err.code from better-sqlite3 on constraint violation", () => {
    const exec = setup();
    db.prepare("CREATE TABLE t (id INTEGER PRIMARY KEY)").run();
    db.prepare("INSERT INTO t VALUES (1)").run();

    const outcome = exec.execute("INSERT INTO t VALUES (1)");

    expect(outcome.kind).toBe("error");
    if (outcome.kind !== "error") throw new Error("expected error");
    expect(outcome.code).toMatch(/^SQLITE_CONSTRAINT/);
  });

  it("returns error outcome for empty input", () => {
    const exec = setup();

    const outcome = exec.execute("");

    expect(outcome.kind).toBe("error");
    if (outcome.kind !== "error") throw new Error("expected error");
    expect(outcome.message).toBe("empty query");
  });

  it("returns error outcome for whitespace-only input", () => {
    const exec = setup();

    const outcome = exec.execute("   \t\n  ");

    expect(outcome.kind).toBe("error");
    if (outcome.kind !== "error") throw new Error("expected error");
    expect(outcome.message).toBe("empty query");
  });

  it("executes PRAGMA reader and returns rows", () => {
    const exec = setup();

    const outcome = exec.execute("PRAGMA user_version");

    expect(outcome.kind).toBe("rows");
    if (outcome.kind !== "rows") throw new Error("expected rows");
    expect(outcome.columns.map((c) => c.name)).toEqual(["user_version"]);
    expect(outcome.rows).toEqual([[0]]);
  });

  it("executes PRAGMA setter and returns affected outcome", () => {
    const exec = setup();

    const outcome = exec.execute("PRAGMA user_version = 7");

    expect(outcome.kind).toBe("affected");
    if (outcome.kind !== "affected") throw new Error("expected affected");
    expect(outcome.changes).toBe(0);
    expect(Number(outcome.lastInsertRowid)).toBe(0);
    expect(db.prepare("PRAGMA user_version").all()).toEqual([[7]]);
  });

  it("executes EXPLAIN and returns rows", () => {
    const exec = setup();

    const outcome = exec.execute("EXPLAIN SELECT 1");

    expect(outcome.kind).toBe("rows");
    if (outcome.kind !== "rows") throw new Error("expected rows");
    expect(outcome.columns.map((c) => c.name)).toContain("addr");
    expect(outcome.columns.map((c) => c.name)).toContain("opcode");
    expect(outcome.rows.length).toBeGreaterThan(0);
  });

  it("executes SELECT without trailing semicolon and returns rows", () => {
    const exec = setup();

    const outcome = exec.execute("SELECT 1 AS a");

    expect(outcome.kind).toBe("rows");
    if (outcome.kind !== "rows") throw new Error("expected rows");
    expect(outcome.columns).toEqual([{ name: "a", type: null }]);
    expect(outcome.rows).toEqual([[1]]);
  });

  it("executes VACUUM and returns affected outcome", () => {
    const exec = setup();
    db.prepare("CREATE TABLE t (id INTEGER)").run();
    db.prepare("INSERT INTO t VALUES (1), (2)").run();

    const outcome = exec.execute("VACUUM");

    expect(outcome.kind).toBe("affected");
    if (outcome.kind !== "affected") throw new Error("expected affected");
    expect(outcome.changes).toBe(0);
  });
});
