import type {
  BindParams,
  Database,
  PreparedStatement,
} from "../../domain/database/Database.ts";
import { classifySideEffect } from "../../domain/sql/classifySideEffect.ts";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";

export class ExecuteQuery {
  private readonly db: Database;
  private readonly bindParams: () => BindParams;

  constructor(db: Database, bindParams: () => BindParams = () => ({})) {
    this.db = db;
    this.bindParams = bindParams;
  }

  execute(sql: string): QueryOutcome {
    const trimmed = sql.trim();
    if (trimmed === "") return { kind: "error", message: "empty query" };

    let stmt: PreparedStatement;
    try {
      stmt = this.db.prepare(trimmed);
    } catch (err) {
      return this.toError(err);
    }

    const params = this.bindParams();
    try {
      if (stmt.reader) {
        const columns = stmt.columns();
        const rows = stmt.all(params);
        return stmt.readonly
          ? { kind: "rows", columns, rows }
          : { kind: "rows", columns, rows, writes: true };
      }
      const info = stmt.run(params);
      if (classifySideEffect(trimmed)) {
        return { kind: "side-effect" };
      }
      return {
        kind: "affected",
        changes: info.changes,
        lastInsertRowid: info.lastInsertRowid,
      };
    } catch (err) {
      return this.toError(err);
    }
  }

  private toError(err: unknown): QueryOutcome {
    if (err instanceof Error) {
      const code =
        "code" in err && typeof (err as { code: unknown }).code === "string"
          ? (err as { code: string }).code
          : undefined;
      const message = rewriteBindError(err.message);
      return code !== undefined
        ? { kind: "error", code, message }
        : { kind: "error", message };
    }
    return { kind: "error", message: String(err) };
  }
}

function rewriteBindError(message: string): string {
  const match = message.match(/Missing named parameter "([^"]+)"/);
  if (match === null) return message;
  const name = match[1];
  return `variable :${name} is not defined (.set ${name} <value>)`;
}
