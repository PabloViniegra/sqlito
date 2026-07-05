import { BuildPlanTree } from "../../domain/sql/BuildPlanTree.ts";
import { isReadOnly } from "../../domain/sql/isReadOnly.ts";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";
import type { ExecuteQuery } from "./ExecuteQuery.ts";

export class RunExplain {
  private readonly executeQuery: ExecuteQuery;

  constructor(executeQuery: ExecuteQuery) {
    this.executeQuery = executeQuery;
  }

  explainLast(sql: string): QueryOutcome {
    const trimmed = sql.trim();
    if (trimmed === "") {
      return { kind: "error", message: "no previous query to explain" };
    }
    if (!isReadOnly(trimmed)) {
      return { kind: "error", message: "cannot explain a write statement" };
    }
    const outcome = this.executeQuery.execute(`EXPLAIN QUERY PLAN ${trimmed}`);
    if (outcome.kind === "rows") {
      return { kind: "plan", nodes: BuildPlanTree(outcome.rows) };
    }
    return outcome;
  }
}
