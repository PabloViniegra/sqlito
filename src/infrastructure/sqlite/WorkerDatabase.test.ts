import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DatabaseError,
  QueryCancelled,
} from "../../domain/database/Database.ts";
import { WorkerDatabase } from "./WorkerDatabase.ts";

// a recursive CTE that keeps native SQLite busy far longer than any test waits
const ENDLESS_SQL =
  "WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n) SELECT count(*) FROM n";

describe("WorkerDatabase", () => {
  let dir: string;
  let db: WorkerDatabase;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "sqlito-worker-"));
    db = new WorkerDatabase(join(dir, "test.db"));
  });

  afterEach(async () => {
    await db.close();
    await rm(dir, { recursive: true, force: true });
  });

  it("runs statements on the worker and returns rows", async () => {
    await db.execute("CREATE TABLE t (id INTEGER, name TEXT)");
    await db.execute("INSERT INTO t VALUES (1, 'a'), (2, 'b')");

    const result = await db.execute(
      "SELECT * FROM t ORDER BY id",
      {},
      {
        maxRows: 1,
      },
    );

    expect(result).toMatchObject({
      kind: "rows",
      rows: [[1, "a"]],
      truncated: true,
      readonly: true,
    });
  });

  it("preserves integers beyond 2^53 across the thread boundary", async () => {
    const result = await db.execute("SELECT 9007199254740993 AS big");

    expect(result).toMatchObject({ rows: [[9007199254740993n]] });
  });

  it("rejects with a DatabaseError that keeps the SQLite code", async () => {
    const failure = db.execute("SELECT * FROM missing");

    await expect(failure).rejects.toBeInstanceOf(DatabaseError);
    await expect(failure).rejects.toMatchObject({ code: "SQLITE_ERROR" });
  });

  it("cancels a running statement and keeps serving on a fresh connection", async () => {
    await db.execute("CREATE TABLE kept (id INTEGER)");
    const running = db.execute(ENDLESS_SQL);
    await new Promise((r) => setTimeout(r, 50));

    expect(db.cancel()).toBe(true);
    await expect(running).rejects.toBeInstanceOf(QueryCancelled);

    // the killed connection held a read lock; a surviving one would make this write SQLITE_BUSY
    await db.execute("INSERT INTO kept VALUES (1)");
    const after = await db.execute("SELECT count(*) FROM kept");
    expect(after).toMatchObject({ rows: [[1]] });
  });

  it("rejects writes when opened read-only", async () => {
    await db.execute("CREATE TABLE t (id INTEGER)");
    const readonly = new WorkerDatabase(join(dir, "test.db"), {
      readonly: true,
    });
    try {
      await expect(
        readonly.execute("SELECT count(*) FROM t"),
      ).resolves.toMatchObject({ rows: [[0]] });
      await expect(
        readonly.execute("INSERT INTO t VALUES (1)"),
      ).rejects.toMatchObject({ code: "SQLITE_READONLY" });
    } finally {
      await readonly.close();
    }
  });

  it("reports nothing to cancel when idle", () => {
    expect(db.cancel()).toBe(false);
  });

  it("rejects requests in flight when closed", async () => {
    const rejection = expect(db.execute(ENDLESS_SQL)).rejects.toThrow(
      "database is closed",
    );

    await db.close();

    await rejection;
  });

  it("refuses new requests after close instead of reopening", async () => {
    await db.close();

    await expect(db.execute("SELECT 1")).rejects.toThrow("database is closed");
  });
});
