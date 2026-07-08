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

  it("executes INSERT … RETURNING and returns the rows, flagged as writes", () => {
    const exec = setup();
    db.prepare("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)").run();

    const outcome = exec.execute(
      "INSERT INTO t (name) VALUES ('Ada'), ('Lin') RETURNING id, name",
    );

    expect(outcome.kind).toBe("rows");
    if (outcome.kind !== "rows") throw new Error("expected rows");
    expect(outcome.writes).toBe(true);
    expect(outcome.rows).toEqual([
      [1, "Ada"],
      [2, "Lin"],
    ]);
    expect(db.prepare("SELECT count(*) FROM t").all()).toEqual([[2]]);
  });

  it("executes DELETE … RETURNING and returns the deleted rows", () => {
    const exec = setup();
    db.prepare("CREATE TABLE t (id INTEGER PRIMARY KEY)").run();
    db.prepare("INSERT INTO t VALUES (1), (2)").run();

    const outcome = exec.execute("DELETE FROM t RETURNING id");

    expect(outcome.kind).toBe("rows");
    if (outcome.kind !== "rows") throw new Error("expected rows");
    expect(outcome.writes).toBe(true);
    expect(outcome.rows).toEqual([[1], [2]]);
  });

  it("executes a CTE write (WITH … UPDATE) as affected, not as a read", () => {
    const exec = setup();
    db.prepare("CREATE TABLE t (id INTEGER, name TEXT)").run();
    db.prepare("INSERT INTO t VALUES (1, 'a'), (2, 'b')").run();

    const outcome = exec.execute(
      "WITH picked AS (SELECT 1 AS id) UPDATE t SET name = 'x' WHERE id IN (SELECT id FROM picked)",
    );

    expect(outcome.kind).toBe("affected");
    if (outcome.kind !== "affected") throw new Error("expected affected");
    expect(outcome.changes).toBe(1);
  });

  it("does not flag plain SELECT rows as writes", () => {
    const exec = setup();

    const outcome = exec.execute("SELECT 1 AS a");

    expect(outcome.kind).toBe("rows");
    if (outcome.kind !== "rows") throw new Error("expected rows");
    expect(outcome.writes).toBeUndefined();
  });

  it("executes CREATE TABLE (DDL) and returns side-effect outcome", () => {
    const exec = setup();

    const outcome = exec.execute("CREATE TABLE t (id INTEGER)");

    expect(outcome.kind).toBe("side-effect");
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

  it("executes PRAGMA setter and returns side-effect outcome", () => {
    const exec = setup();

    const outcome = exec.execute("PRAGMA user_version = 7");

    expect(outcome.kind).toBe("side-effect");
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

  it("executes VACUUM and returns side-effect outcome", () => {
    const exec = setup();
    db.prepare("CREATE TABLE t (id INTEGER)").run();
    db.prepare("INSERT INTO t VALUES (1), (2)").run();

    const outcome = exec.execute("VACUUM");

    expect(outcome.kind).toBe("side-effect");
  });

  it("executes REINDEX and returns side-effect outcome", () => {
    const exec = setup();
    db.prepare("CREATE TABLE t (id INTEGER PRIMARY KEY)").run();
    db.prepare("INSERT INTO t VALUES (1)").run();

    const outcome = exec.execute("REINDEX");

    expect(outcome.kind).toBe("side-effect");
  });

  it("executes ANALYZE and returns side-effect outcome", () => {
    const exec = setup();
    db.prepare("CREATE TABLE t (id INTEGER)").run();

    const outcome = exec.execute("ANALYZE");

    expect(outcome.kind).toBe("side-effect");
  });

  it("executes DROP TABLE and returns side-effect outcome", () => {
    const exec = setup();
    db.prepare("CREATE TABLE t (id INTEGER)").run();

    const outcome = exec.execute("DROP TABLE t");

    expect(outcome.kind).toBe("side-effect");
  });

  it("executes ALTER TABLE and returns side-effect outcome", () => {
    const exec = setup();
    db.prepare("CREATE TABLE t (id INTEGER)").run();

    const outcome = exec.execute("ALTER TABLE t ADD COLUMN name TEXT");

    expect(outcome.kind).toBe("side-effect");
  });
});

describe("ExecuteQuery with bind params", () => {
  let db: BetterSqliteDatabase;

  afterEach(() => db?.close());

  it("binds a numeric :vars parameter through ExecuteQuery", () => {
    db = new BetterSqliteDatabase(":memory:");
    const exec = new ExecuteQuery(db, () => ({ foo: 5 }));

    const outcome = exec.execute("SELECT :foo AS x");

    expect(outcome.kind).toBe("rows");
    if (outcome.kind !== "rows") throw new Error("expected rows");
    expect(outcome.rows).toEqual([[5]]);
  });

  it("errors when a :vars parameter has no binding", () => {
    db = new BetterSqliteDatabase(":memory:");
    const exec = new ExecuteQuery(db, () => ({}));

    const outcome = exec.execute("SELECT :foo AS x");

    expect(outcome.kind).toBe("error");
    if (outcome.kind !== "error") throw new Error("expected error");
    expect(outcome.message).toMatch(/:foo/);
  });

  it("leaves :foo literal when it appears inside a single-quoted string", () => {
    db = new BetterSqliteDatabase(":memory:");
    const exec = new ExecuteQuery(db, () => ({}));

    const outcome = exec.execute("SELECT 'value :foo' AS x");

    expect(outcome.kind).toBe("rows");
    if (outcome.kind !== "rows") throw new Error("expected rows");
    expect(outcome.rows).toEqual([["value :foo"]]);
  });

  it("binds numeric params and lets SQL coerce them", () => {
    db = new BetterSqliteDatabase(":memory:");
    const exec = new ExecuteQuery(db, () => ({ n: 41 }));

    const outcome = exec.execute("SELECT :n + 1 AS x");

    expect(outcome.kind).toBe("rows");
    if (outcome.kind !== "rows") throw new Error("expected rows");
    expect(outcome.rows).toEqual([[42]]);
  });

  it("binds string params", () => {
    db = new BetterSqliteDatabase(":memory:");
    const exec = new ExecuteQuery(db, () => ({ s: "hello" }));

    const outcome = exec.execute("SELECT :s AS x");

    expect(outcome.kind).toBe("rows");
    if (outcome.kind !== "rows") throw new Error("expected rows");
    expect(outcome.rows).toEqual([["hello"]]);
  });

  it("binds numeric params coerced from boolean at the call site (SessionVariables' job upstream)", () => {
    db = new BetterSqliteDatabase(":memory:");
    const exec = new ExecuteQuery(db, () => ({ b: 1 }));

    const outcome = exec.execute("SELECT :b AS x");

    expect(outcome.kind).toBe("rows");
    if (outcome.kind !== "rows") throw new Error("expected rows");
    expect(outcome.rows).toEqual([[1]]);
  });

  it("binds null params", () => {
    db = new BetterSqliteDatabase(":memory:");
    const exec = new ExecuteQuery(db, () => ({ x: null }));

    const outcome = exec.execute("SELECT :x AS x");

    expect(outcome.kind).toBe("rows");
    if (outcome.kind !== "rows") throw new Error("expected rows");
    expect(outcome.rows).toEqual([[null]]);
  });

  it("binds params into the run() path (INSERT)", () => {
    db = new BetterSqliteDatabase(":memory:");
    db.prepare("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)").run();
    const exec = new ExecuteQuery(db, () => ({ name: "Ada" }));

    const outcome = exec.execute("INSERT INTO t (name) VALUES (:name)");

    expect(outcome.kind).toBe("affected");
    if (outcome.kind !== "affected") throw new Error("expected affected");
    expect(outcome.changes).toBe(1);
    const verify = db.prepare("SELECT name FROM t").all();
    expect(verify).toEqual([["Ada"]]);
  });
});
