import { afterEach, describe, expect, it } from "vitest";
import { BetterSqliteDatabase } from "../../infrastructure/sqlite/BetterSqliteDatabase.ts";
import type { BindParams } from "../../domain/database/Database.ts";
import { ExecuteQuery } from "./ExecuteQuery.ts";
import { RunExplain } from "./RunExplain.ts";

describe("RunExplain", () => {
  let db: BetterSqliteDatabase;

  afterEach(() => db?.close());

  const setup = (bind: () => BindParams = () => ({})): RunExplain => {
    db = new BetterSqliteDatabase(":memory:");
    db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, n INTEGER)");
    db.exec("INSERT INTO t (n) VALUES (1), (2), (3)");
    return new RunExplain(new ExecuteQuery(db, bind));
  };

  it("errors when there is no previous query", async () => {
    const explain = setup();
    expect(await explain.explainLast("")).toEqual({
      kind: "error",
      message: "no previous query to explain",
    });
  });

  it("errors when only whitespace is given", async () => {
    const explain = setup();
    expect(await explain.explainLast("   ")).toEqual({
      kind: "error",
      message: "no previous query to explain",
    });
  });

  it("returns a plan outcome for a SELECT", async () => {
    const explain = setup();
    const outcome = await explain.explainLast("SELECT * FROM t");
    expect(outcome.kind).toBe("plan");
    if (outcome.kind !== "plan") throw new Error("expected plan");
    expect(outcome.nodes.length).toBeGreaterThan(0);
  });

  it("errors for a write statement", async () => {
    const explain = setup();
    expect(await explain.explainLast("INSERT INTO t (n) VALUES (9)")).toEqual({
      kind: "error",
      message: "cannot explain a write statement",
    });
  });

  it("substitutes session variables before planning", async () => {
    const explain = setup(() => ({ threshold: 2 }));
    const outcome = await explain.explainLast(
      "SELECT * FROM t WHERE n > :threshold",
    );
    expect(outcome.kind).toBe("plan");
  });

  it("propagates an execution error for invalid SQL", async () => {
    const explain = setup();
    const outcome = await explain.explainLast("SELECT FROM");
    expect(outcome.kind).toBe("error");
  });
});
