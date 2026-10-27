import { afterEach, describe, expect, it } from "vitest";
import { BetterSqliteDatabase } from "../../infrastructure/sqlite/BetterSqliteDatabase.ts";
import { allRows } from "../../shared/utils/test-helpers.ts";
import {
  QueryCancelled,
  type Database,
} from "../../domain/database/Database.ts";
import { ExecuteQuery, MAX_RESULT_ROWS } from "./ExecuteQuery.ts";

describe("ExecuteQuery", () => {
  let db: BetterSqliteDatabase;
  let useCase: ExecuteQuery;

  afterEach(() => db?.close());

  const setup = (): ExecuteQuery => {
    db = new BetterSqliteDatabase(":memory:");
    useCase = new ExecuteQuery(db);
    return useCase;
  };

  it("executes SELECT and returns rows", async () => {
    const exec = setup();

    const outcome = await exec.execute("SELECT 1 AS a");

    expect(outcome.kind).toBe("rows");
    if (outcome.kind !== "rows") throw new Error("expected rows");
    expect(outcome.columns).toEqual([{ name: "a", type: null }]);
    expect(outcome.rows).toEqual([[1]]);
  });

  it("executes SELECT with multiple rows and preserves cell values", async () => {
    const exec = setup();
    db.exec("CREATE TABLE t (id INTEGER, name TEXT)");
    db.exec("INSERT INTO t VALUES (1, 'Ada'), (2, 'Lin')");

    const outcome = await exec.execute("SELECT id, name FROM t ORDER BY id");

    expect(outcome.kind).toBe("rows");
    if (outcome.kind !== "rows") throw new Error("expected rows");
    expect(outcome.columns.map((c) => c.name)).toEqual(["id", "name"]);
    expect(outcome.rows).toEqual([
      [1, "Ada"],
      [2, "Lin"],
    ]);
  });

  it("returns empty rows when SELECT matches nothing", async () => {
    const exec = setup();

    const outcome = await exec.execute("SELECT 1 WHERE 0");

    expect(outcome.kind).toBe("rows");
    if (outcome.kind !== "rows") throw new Error("expected rows");
    expect(outcome.rows).toEqual([]);
  });

  it("returns error outcome for invalid SQL", async () => {
    const exec = setup();

    const outcome = await exec.execute("SELECT FROM");

    expect(outcome.kind).toBe("error");
  });

  it("executes INSERT and returns affected outcome", async () => {
    const exec = setup();
    db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)");

    const outcome = await exec.execute("INSERT INTO t (name) VALUES ('Ada')");

    expect(outcome.kind).toBe("affected");
    if (outcome.kind !== "affected") throw new Error("expected affected");
    expect(outcome.changes).toBe(1);
    expect(Number(outcome.lastInsertRowid)).toBeGreaterThan(0);
  });

  it("executes INSERT … RETURNING and returns the rows, flagged as writes", async () => {
    const exec = setup();
    db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)");

    const outcome = await exec.execute(
      "INSERT INTO t (name) VALUES ('Ada'), ('Lin') RETURNING id, name",
    );

    expect(outcome.kind).toBe("rows");
    if (outcome.kind !== "rows") throw new Error("expected rows");
    expect(outcome.writes).toBe(true);
    expect(outcome.rows).toEqual([
      [1, "Ada"],
      [2, "Lin"],
    ]);
    expect(await allRows(db, "SELECT count(*) FROM t")).toEqual([[2]]);
  });

  it("executes DELETE … RETURNING and returns the deleted rows", async () => {
    const exec = setup();
    db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY)");
    db.exec("INSERT INTO t VALUES (1), (2)");

    const outcome = await exec.execute("DELETE FROM t RETURNING id");

    expect(outcome.kind).toBe("rows");
    if (outcome.kind !== "rows") throw new Error("expected rows");
    expect(outcome.writes).toBe(true);
    expect(outcome.rows).toEqual([[1], [2]]);
  });

  it("executes a CTE write (WITH … UPDATE) as affected, not as a read", async () => {
    const exec = setup();
    db.exec("CREATE TABLE t (id INTEGER, name TEXT)");
    db.exec("INSERT INTO t VALUES (1, 'a'), (2, 'b')");

    const outcome = await exec.execute(
      "WITH picked AS (SELECT 1 AS id) UPDATE t SET name = 'x' WHERE id IN (SELECT id FROM picked)",
    );

    expect(outcome.kind).toBe("affected");
    if (outcome.kind !== "affected") throw new Error("expected affected");
    expect(outcome.changes).toBe(1);
  });

  it("does not flag plain SELECT rows as writes", async () => {
    const exec = setup();

    const outcome = await exec.execute("SELECT 1 AS a");

    expect(outcome.kind).toBe("rows");
    if (outcome.kind !== "rows") throw new Error("expected rows");
    expect(outcome.writes).toBeUndefined();
  });

  it("executes CREATE TABLE (DDL) and returns side-effect outcome", async () => {
    const exec = setup();

    const outcome = await exec.execute("CREATE TABLE t (id INTEGER)");

    expect(outcome.kind).toBe("side-effect");
  });

  it("executes UPDATE and returns affected outcome with change count", async () => {
    const exec = setup();
    db.exec("CREATE TABLE t (id INTEGER, name TEXT)");
    db.exec("INSERT INTO t VALUES (1, 'a'), (2, 'b')");

    const outcome = await exec.execute("UPDATE t SET name = 'x' WHERE id = 1");

    expect(outcome.kind).toBe("affected");
    if (outcome.kind !== "affected") throw new Error("expected affected");
    expect(outcome.changes).toBe(1);
  });

  it("returns error outcome for syntax error", async () => {
    const exec = setup();

    const outcome = await exec.execute("SELECT syntax_error");

    expect(outcome.kind).toBe("error");
    if (outcome.kind !== "error") throw new Error("expected error");
    expect(outcome.message.length).toBeGreaterThan(0);
  });

  it("captures err.code from better-sqlite3 on constraint violation", async () => {
    const exec = setup();
    db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY)");
    db.exec("INSERT INTO t VALUES (1)");

    const outcome = await exec.execute("INSERT INTO t VALUES (1)");

    expect(outcome.kind).toBe("error");
    if (outcome.kind !== "error") throw new Error("expected error");
    expect(outcome.code).toMatch(/^SQLITE_CONSTRAINT/);
  });

  it("returns error outcome for empty input", async () => {
    const exec = setup();

    const outcome = await exec.execute("");

    expect(outcome.kind).toBe("error");
    if (outcome.kind !== "error") throw new Error("expected error");
    expect(outcome.message).toBe("empty query");
  });

  it("returns error outcome for whitespace-only input", async () => {
    const exec = setup();

    const outcome = await exec.execute("   \t\n  ");

    expect(outcome.kind).toBe("error");
    if (outcome.kind !== "error") throw new Error("expected error");
    expect(outcome.message).toBe("empty query");
  });

  it("executes PRAGMA reader and returns rows", async () => {
    const exec = setup();

    const outcome = await exec.execute("PRAGMA user_version");

    expect(outcome.kind).toBe("rows");
    if (outcome.kind !== "rows") throw new Error("expected rows");
    expect(outcome.columns.map((c) => c.name)).toEqual(["user_version"]);
    expect(outcome.rows).toEqual([[0]]);
  });

  it("executes PRAGMA setter and returns side-effect outcome", async () => {
    const exec = setup();

    const outcome = await exec.execute("PRAGMA user_version = 7");

    expect(outcome.kind).toBe("side-effect");
    expect(await allRows(db, "PRAGMA user_version")).toEqual([[7]]);
  });

  it("executes EXPLAIN and returns rows", async () => {
    const exec = setup();

    const outcome = await exec.execute("EXPLAIN SELECT 1");

    expect(outcome.kind).toBe("rows");
    if (outcome.kind !== "rows") throw new Error("expected rows");
    expect(outcome.columns.map((c) => c.name)).toContain("addr");
    expect(outcome.columns.map((c) => c.name)).toContain("opcode");
    expect(outcome.rows.length).toBeGreaterThan(0);
  });

  it("executes SELECT without trailing semicolon and returns rows", async () => {
    const exec = setup();

    const outcome = await exec.execute("SELECT 1 AS a");

    expect(outcome.kind).toBe("rows");
    if (outcome.kind !== "rows") throw new Error("expected rows");
    expect(outcome.columns).toEqual([{ name: "a", type: null }]);
    expect(outcome.rows).toEqual([[1]]);
  });

  it("executes VACUUM and returns side-effect outcome", async () => {
    const exec = setup();
    db.exec("CREATE TABLE t (id INTEGER)");
    db.exec("INSERT INTO t VALUES (1), (2)");

    const outcome = await exec.execute("VACUUM");

    expect(outcome.kind).toBe("side-effect");
  });

  it("executes REINDEX and returns side-effect outcome", async () => {
    const exec = setup();
    db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY)");
    db.exec("INSERT INTO t VALUES (1)");

    const outcome = await exec.execute("REINDEX");

    expect(outcome.kind).toBe("side-effect");
  });

  it("executes ANALYZE and returns side-effect outcome", async () => {
    const exec = setup();
    db.exec("CREATE TABLE t (id INTEGER)");

    const outcome = await exec.execute("ANALYZE");

    expect(outcome.kind).toBe("side-effect");
  });

  it("executes DROP TABLE and returns side-effect outcome", async () => {
    const exec = setup();
    db.exec("CREATE TABLE t (id INTEGER)");

    const outcome = await exec.execute("DROP TABLE t");

    expect(outcome.kind).toBe("side-effect");
  });

  it("executes ALTER TABLE and returns side-effect outcome", async () => {
    const exec = setup();
    db.exec("CREATE TABLE t (id INTEGER)");

    const outcome = await exec.execute("ALTER TABLE t ADD COLUMN name TEXT");

    expect(outcome.kind).toBe("side-effect");
  });
});

describe("ExecuteQuery with bind params", () => {
  let db: BetterSqliteDatabase;

  afterEach(() => db?.close());

  it("binds a numeric :vars parameter through ExecuteQuery", async () => {
    db = new BetterSqliteDatabase(":memory:");
    const exec = new ExecuteQuery(db, () => ({ foo: 5 }));

    const outcome = await exec.execute("SELECT :foo AS x");

    expect(outcome.kind).toBe("rows");
    if (outcome.kind !== "rows") throw new Error("expected rows");
    expect(outcome.rows).toEqual([[5]]);
  });

  it("errors when a :vars parameter has no binding", async () => {
    db = new BetterSqliteDatabase(":memory:");
    const exec = new ExecuteQuery(db, () => ({}));

    const outcome = await exec.execute("SELECT :foo AS x");

    expect(outcome.kind).toBe("error");
    if (outcome.kind !== "error") throw new Error("expected error");
    expect(outcome.message).toMatch(/:foo/);
  });

  it("leaves :foo literal when it appears inside a single-quoted string", async () => {
    db = new BetterSqliteDatabase(":memory:");
    const exec = new ExecuteQuery(db, () => ({}));

    const outcome = await exec.execute("SELECT 'value :foo' AS x");

    expect(outcome.kind).toBe("rows");
    if (outcome.kind !== "rows") throw new Error("expected rows");
    expect(outcome.rows).toEqual([["value :foo"]]);
  });

  it("binds numeric params and lets SQL coerce them", async () => {
    db = new BetterSqliteDatabase(":memory:");
    const exec = new ExecuteQuery(db, () => ({ n: 41 }));

    const outcome = await exec.execute("SELECT :n + 1 AS x");

    expect(outcome.kind).toBe("rows");
    if (outcome.kind !== "rows") throw new Error("expected rows");
    expect(outcome.rows).toEqual([[42]]);
  });

  it("binds string params", async () => {
    db = new BetterSqliteDatabase(":memory:");
    const exec = new ExecuteQuery(db, () => ({ s: "hello" }));

    const outcome = await exec.execute("SELECT :s AS x");

    expect(outcome.kind).toBe("rows");
    if (outcome.kind !== "rows") throw new Error("expected rows");
    expect(outcome.rows).toEqual([["hello"]]);
  });

  it("binds numeric params coerced from boolean at the call site (SessionVariables' job upstream)", async () => {
    db = new BetterSqliteDatabase(":memory:");
    const exec = new ExecuteQuery(db, () => ({ b: 1 }));

    const outcome = await exec.execute("SELECT :b AS x");

    expect(outcome.kind).toBe("rows");
    if (outcome.kind !== "rows") throw new Error("expected rows");
    expect(outcome.rows).toEqual([[1]]);
  });

  it("binds null params", async () => {
    db = new BetterSqliteDatabase(":memory:");
    const exec = new ExecuteQuery(db, () => ({ x: null }));

    const outcome = await exec.execute("SELECT :x AS x");

    expect(outcome.kind).toBe("rows");
    if (outcome.kind !== "rows") throw new Error("expected rows");
    expect(outcome.rows).toEqual([[null]]);
  });

  it("binds params into the run() path (INSERT)", async () => {
    db = new BetterSqliteDatabase(":memory:");
    db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)");
    const exec = new ExecuteQuery(db, () => ({ name: "Ada" }));

    const outcome = await exec.execute("INSERT INTO t (name) VALUES (:name)");

    expect(outcome.kind).toBe("affected");
    if (outcome.kind !== "affected") throw new Error("expected affected");
    expect(outcome.changes).toBe(1);
    const verify = await allRows(db, "SELECT name FROM t");
    expect(verify).toEqual([["Ada"]]);
  });
});

describe("ExecuteQuery result bounds", () => {
  let db: BetterSqliteDatabase;

  afterEach(() => db?.close());

  it("loads at most MAX_RESULT_ROWS rows and flags the result as truncated", async () => {
    db = new BetterSqliteDatabase(":memory:");
    const exec = new ExecuteQuery(db);

    const outcome = await exec.execute(
      "WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c) SELECT x FROM c",
    );

    if (outcome.kind !== "rows") throw new Error("expected rows");
    expect(outcome.rows).toHaveLength(MAX_RESULT_ROWS);
    expect(outcome.truncated).toBe(true);
  });

  it("pins the SQL and the variables it ran with so the full result can be reloaded", async () => {
    db = new BetterSqliteDatabase(":memory:");
    const exec = new ExecuteQuery(db, () => ({ start: 5 }));

    const outcome = await exec.execute(
      "WITH RECURSIVE c(x) AS (SELECT :start UNION ALL SELECT x + 1 FROM c) SELECT x FROM c",
    );

    if (outcome.kind !== "rows") throw new Error("expected rows");
    expect(outcome.rerun).toEqual({
      sql: "WITH RECURSIVE c(x) AS (SELECT :start UNION ALL SELECT x + 1 FROM c) SELECT x FROM c",
      params: { start: 5 },
    });
  });

  it("does not flag a result that fits exactly", async () => {
    db = new BetterSqliteDatabase(":memory:");
    const exec = new ExecuteQuery(db);

    const outcome = await exec.execute(
      `WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c LIMIT ${MAX_RESULT_ROWS}) SELECT x FROM c`,
    );

    if (outcome.kind !== "rows") throw new Error("expected rows");
    expect(outcome.rows).toHaveLength(MAX_RESULT_ROWS);
    expect(outcome.truncated).toBeUndefined();
  });

  it("keeps integers beyond 2^53 exact as bigint", async () => {
    db = new BetterSqliteDatabase(":memory:");
    const exec = new ExecuteQuery(db);

    const outcome = await exec.execute(
      "SELECT 9007199254740993 AS big, 42 AS small",
    );

    if (outcome.kind !== "rows") throw new Error("expected rows");
    expect(outcome.rows).toEqual([[9007199254740993n, 42]]);
  });

  it("keeps every column when two share a name", async () => {
    db = new BetterSqliteDatabase(":memory:");
    const exec = new ExecuteQuery(db);

    const outcome = await exec.execute("SELECT 1 AS id, 2 AS id");

    if (outcome.kind !== "rows") throw new Error("expected rows");
    expect(outcome.rows).toEqual([[1, 2]]);
  });

  it("maps a cancelled statement to an error outcome", async () => {
    const cancelled: Database = {
      execute: () => Promise.reject(new QueryCancelled()),
      exportCsv: () => Promise.reject(new QueryCancelled()),
      cancel: () => true,
      close: async () => {},
    };

    const outcome = await new ExecuteQuery(cancelled).execute("SELECT 1");

    expect(outcome).toEqual({
      kind: "error",
      message:
        "query cancelled; connection reset, any open transaction was rolled back",
    });
  });
});
