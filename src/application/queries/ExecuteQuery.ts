import {
  DatabaseError,
  QueryCancelled,
  type BindParams,
  type Database,
  type StatementResult,
} from "../../domain/database/Database.ts";
import { classifySideEffect } from "../../domain/sql/classifySideEffect.ts";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";

/** Rows kept in memory per result; .export re-runs read-only queries in full. */
export const MAX_RESULT_ROWS = 1000;

export class ExecuteQuery {
  private readonly db: Database;
  private readonly bindParams: () => BindParams;

  constructor(db: Database, bindParams: () => BindParams = () => ({})) {
    this.db = db;
    this.bindParams = bindParams;
  }

  async execute(sql: string): Promise<QueryOutcome> {
    const trimmed = sql.trim();
    if (trimmed === "") return { kind: "error", message: "empty query" };

    const params = this.bindParams();
    let result: StatementResult;
    try {
      result = await this.db.execute(trimmed, params, {
        maxRows: MAX_RESULT_ROWS,
      });
    } catch (err) {
      return toError(err);
    }

    if (result.kind === "rows") {
      return {
        kind: "rows",
        columns: result.columns,
        rows: result.rows,
        ...(!result.readonly && { writes: true }),
        ...(result.truncated && { truncated: true }),
        ...(result.truncated &&
          result.readonly && { rerun: { sql: trimmed, params } }),
      };
    }
    if (classifySideEffect(trimmed)) return { kind: "side-effect" };
    return {
      kind: "affected",
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid,
    };
  }
}

function toError<T>(err: T): QueryOutcome {
  if (err instanceof QueryCancelled) {
    return {
      kind: "error",
      message: `${err.message}; connection reset, any open transaction was rolled back`,
    };
  }
  if (err instanceof Error) {
    const message = rewriteBindError(err.message);
    return err instanceof DatabaseError && err.code !== undefined
      ? { kind: "error", code: err.code, message }
      : { kind: "error", message };
  }
  return { kind: "error", message: String(err) };
}

function rewriteBindError(message: string): string {
  const match = message.match(/Missing named parameter "([^"]+)"/);
  if (match === null) return message;
  const name = match[1];
  return `variable :${name} is not defined (.set ${name} <value>)`;
}
